import { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm, Fields, Files, File } from 'formidable';
import archiver from 'archiver';
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from 'stream';
import { contractCompiler } from '@/lib/contractCompiler';
import { PassThrough } from 'stream';
import path from "path";
import fs from "fs/promises";

export const config = {
    api: {
        bodyParser: false,
    },
};

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
        : undefined,
});

// Helper functions
const trimExtension = (contractName: string): string => {
    const suffix = '.docx';
    return contractName.endsWith(suffix) ? contractName.slice(0, -suffix.length) : contractName;
};

const getSafeFilepath = (file: File | File[] | undefined): string => {
    if (Array.isArray(file)) {
        return file[0]?.filepath || '';
    }
    return file?.filepath || '';
};

const ensureString = (value: unknown): string => {
    if (typeof value === 'string') {
        return value;
    }
    if (Array.isArray(value) && typeof value[0] === 'string') {
        return value[0];
    }
    return '';
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!process.env.S3_BUCKET_NAME) {
        return res.status(500).json({ error: 'S3_BUCKET_NAME is not defined' });
    }

    try {
        const form = new IncomingForm();
        const [fields, files] = await new Promise<[Fields, Files]>((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err) reject(err);
                resolve([fields, files]);
            });
        });

        const username = ensureString(fields.username);
        const percentuale = ensureString(fields.percentuale);
        const visuraFile = files.visura;
        const creditiFile = files.crediti;

        if (!visuraFile || !creditiFile) {
            return res.status(400).json({ error: 'I file Visura e Crediti sono richiesti.' });
        }

        // Upload Visura and Crediti files to S3
        const visuraKey = `${username}/visura-${Date.now()}.pdf`;
        const creditiKey = `${username}/crediti-${Date.now()}.xlsx`;

        await Promise.all([
            uploadFileToS3(process.env.S3_BUCKET_NAME, visuraKey, getSafeFilepath(visuraFile)),
            uploadFileToS3(process.env.S3_BUCKET_NAME, creditiKey, getSafeFilepath(creditiFile)),
        ]);

        const customReplacements: Record<string, Record<string, string>> = {};
        Object.entries(fields).forEach(([key, value]) => {
            const match = key.match(/customReplacement\[(\d+)]\[(\w+)]/);
            if (match) {
                const [, index, field] = match;
                if (!customReplacements[index]) customReplacements[index] = {};
                customReplacements[index][field] = ensureString(value);
            }
        });

        const zipFileName = `${username}_contracts_${Date.now()}.zip`;
        const archive = archiver('zip', { zlib: { level: 9 } });
        const passThrough = new PassThrough();

        archive.pipe(passThrough);

        const listParams = {
            Bucket: process.env.S3_BUCKET_NAME,
            Prefix: `${username}/`,
        };

        const listResult = await s3Client.send(new ListObjectsV2Command(listParams));
        const fileList = listResult.Contents?.filter(object => object.Key?.endsWith('.docx')).map(object => object.Key!) ?? [];

        for (const file of fileList) {
            const outputKey = `${username}/${trimExtension(file)}Compilato.docx`;

            await contractCompiler(
                process.env.S3_BUCKET_NAME,
                file,
                process.env.S3_BUCKET_NAME,
                outputKey,
                process.env.S3_BUCKET_NAME,
                visuraKey,
                process.env.S3_BUCKET_NAME,
                creditiKey
            );

            const {Body} = await s3Client.send(new GetObjectCommand({
                Bucket: process.env.S3_BUCKET_NAME,
                Key: outputKey,
            }));

            if (Body instanceof Readable) {
                const fileName = path.basename(outputKey);
                if (fileName) {
                    archive.append(Body, {name: fileName});
                } else {
                    console.warn(`Unable to determine file name for ${outputKey}, skipping this file`);
                }
            } else {
                throw new Error(`Unexpected body type for file ${outputKey}`);
            }
        }

        archive.finalize();

        // Upload the zip file to S3
        await new Promise<void>((resolve, reject) => {
            s3Client.send(new PutObjectCommand({
                Bucket: process.env.S3_BUCKET_NAME,
                Key: `${username}/${zipFileName}`,
                Body: passThrough,
            }), (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Generate a pre-signed URL for downloading the zip file
        const url = await getSignedUrl(s3Client, new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: `${username}/${zipFileName}`,
        }), { expiresIn: 3600 }); // URL expires in 1 hour

        res.status(200).json({ url });

        // Clean up temporary files in S3
        await Promise.all([
            s3Client.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: visuraKey })),
            s3Client.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: creditiKey })),
            ...fileList.map(file =>
                s3Client.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: `${username}/${trimExtension(file)}Compilato.docx` }))
            )
        ]);

    } catch (error) {
        console.error('Errore nella compilazione dei contratti:', error);
        res.status(500).json({ error: 'Si è verificato un errore durante la compilazione del contratto.' });
    }
}

async function uploadFileToS3(bucket: string, key: string, filepath: string): Promise<void> {
    const fileContent = await fs.readFile(filepath);
    await s3Client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fileContent,
    }));
}