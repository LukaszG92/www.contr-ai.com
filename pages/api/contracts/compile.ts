import { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm, Fields, Files, File } from 'formidable';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import archiver from 'archiver';
import { Readable } from 'stream';
import { contractCompiler } from '@/lib/contractCompiler';

export const config = {
    api: {
        bodyParser: false,
    },
};

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

const trimExtension = (contractName: string): string => {
    const suffix = '.docx';
    return contractName.endsWith(suffix) ? contractName.slice(0, -suffix.length) : contractName;
};

const getFilename = (contractName: string): string => {
    return path.basename(contractName);
};

const getSafeFilename = (file: File | File[] | undefined): string => {
    if (Array.isArray(file)) {
        return file[0]?.originalFilename || 'unnamed_file';
    }
    return file?.originalFilename || 'unnamed_file';
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

        // Upload visura and crediti files to S3
        const visuraKey = `${username}/visura-${Date.now()}.docx`;
        const creditiKey = `${username}/crediti-${Date.now()}.docx`;

        await s3Client.send(new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: visuraKey,
            Body: await (visuraFile as File).arrayBuffer(),
        }));

        await s3Client.send(new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: creditiKey,
            Body: await (creditiFile as File).arrayBuffer(),
        }));

        // List user's contracts
        const listObjectsResponse = await s3Client.send(new ListObjectsV2Command({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Prefix: `${username}/`,
        }));

        const fileList = listObjectsResponse.Contents || [];

        // Create a writable stream for the zip file
        const archive = archiver('zip', { zlib: { level: 9 } });
        const chunks: any[] = [];

        archive.on('data', (chunk) => chunks.push(chunk));
        archive.on('end', () => {
            const zipBuffer = Buffer.concat(chunks);
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename=${username}_contracts_${Date.now()}.zip`);
            res.status(200).send(zipBuffer);
        });

        for (const file of fileList) {
            if (file.Key && file.Key.endsWith('.docx') && !file.Key.includes('Compilato')) {
                const getObjectCommand = new GetObjectCommand({
                    Bucket: process.env.AWS_S3_BUCKET_NAME,
                    Key: file.Key,
                });

                const { Body } = await s3Client.send(getObjectCommand);

                if (Body instanceof Readable) {
                    const contractBuffer = await new Promise<Buffer>((resolve) => {
                        const chunks: any[] = [];
                        Body.on('data', (chunk) => chunks.push(chunk));
                        Body.on('end', () => resolve(Buffer.concat(chunks)));
                    });

                    const compiledBuffer = await contractCompiler(
                        contractBuffer,
                        await s3Client.send(new GetObjectCommand({ Bucket: process.env.AWS_S3_BUCKET_NAME, Key: visuraKey })).Body,
                        await s3Client.send(new GetObjectCommand({ Bucket: process.env.AWS_S3_BUCKET_NAME, Key: creditiKey })).Body
                    );

                    const compiledKey = `${username}/${trimExtension(file.Key)}Compilato.docx`;
                    await s3Client.send(new PutObjectCommand({
                        Bucket: process.env.AWS_S3_BUCKET_NAME,
                        Key: compiledKey,
                        Body: compiledBuffer,
                    }));

                    archive.append(compiledBuffer, { name: getFilename(compiledKey) });
                }
            }
        }

        archive.finalize();

        // Clean up temporary files in S3
        await s3Client.send(new DeleteObjectCommand({ Bucket: process.env.AWS_S3_BUCKET_NAME, Key: visuraKey }));
        await s3Client.send(new DeleteObjectCommand({ Bucket: process.env.AWS_S3_BUCKET_NAME, Key: creditiKey }));

    } catch (error) {
        console.error('Errore nella compilazione dei contratti:', error);
        res.status(500).json({ error: 'Si è verificato un errore durante la compilazione del contratto.' });
    }
}