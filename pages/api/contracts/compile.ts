import { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm, Fields, Files, File } from 'formidable';
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from 'stream';
import path from "path";
import fs from "fs/promises";
import { contractCompiler } from '@/lib/contractCompiler';
import archiver from 'archiver';

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

async function uploadFileToS3(bucket: string, key: string, filepath: string): Promise<void> {
    const fileContent = await fs.readFile(filepath);
    await s3Client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fileContent,
    }));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    console.log('API route handler started');
    if (req.method !== 'POST') {
        console.log('Invalid method:', req.method);
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!process.env.S3_BUCKET_NAME) {
        console.error('S3_BUCKET_NAME is not defined');
        return res.status(500).json({ error: 'S3_BUCKET_NAME is not defined' });
    }

    try {
        console.log('Parsing form data');
        const form = new IncomingForm();
        const [fields, files] = await new Promise<[Fields, Files]>((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err) reject(err);
                resolve([fields, files]);
            });
        });

        const username = ensureString(fields.username);
        console.log('Username:', username);
        const visuraFile = files.visura;
        const creditiFile = files.crediti;

        if (!visuraFile || !creditiFile) {
            console.error('Missing required files');
            return res.status(400).json({ error: 'Visura and Crediti files are required.' });
        }

        // Upload Visura and Crediti files to S3
        const visuraKey = `${username}/visura-${Date.now()}.pdf`;
        const creditiKey = `${username}/crediti-${Date.now()}.xlsx`;

        console.log('Uploading Visura and Crediti files to S3');
        await Promise.all([
            uploadFileToS3(process.env.S3_BUCKET_NAME, visuraKey, getSafeFilepath(visuraFile)),
            uploadFileToS3(process.env.S3_BUCKET_NAME, creditiKey, getSafeFilepath(creditiFile)),
        ]);

        const zipFileName = `${username}_contracts_${Date.now()}.zip`;
        console.log('Creating zip archive:', zipFileName);
        const archive = archiver('zip', { zlib: { level: 9 } });

        const listParams = {
            Bucket: process.env.S3_BUCKET_NAME,
            Prefix: `${username}/`,
        };

        console.log('Listing .docx files in S3');
        const listResult = await s3Client.send(new ListObjectsV2Command(listParams));
        const fileList = listResult.Contents?.filter(object => object.Key?.endsWith('.docx')).map(object => object.Key!) ?? [];
        console.log('Found', fileList.length, '.docx files');

        for (const file of fileList) {
            console.log('Processing file:', file);
            const outputKey = `${username}/${trimExtension(path.basename(file))}Compilato.docx`;

            console.log('Compiling contract:', file);
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

            console.log('Fetching compiled contract from S3:', outputKey);
            const { Body } = await s3Client.send(new GetObjectCommand({
                Bucket: process.env.S3_BUCKET_NAME,
                Key: outputKey,
            }));

            if (Body instanceof Readable) {
                const fileName = path.basename(outputKey);
                if (fileName) {
                    console.log('Adding file to archive:', fileName);
                    archive.append(Body, { name: fileName });
                } else {
                    console.warn(`Unable to determine file name for ${outputKey}, skipping this file`);
                }
            } else {
                throw new Error(`Unexpected body type for file ${outputKey}`);
            }
        }

        // Finalize the archive and upload to S3
        console.log('Finalizing zip archive');
        const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
            const chunks: any[] = [];
            archive.on('data', (chunk) => chunks.push(chunk));
            archive.on('error', (err) => {
                console.error('Error during archive finalization:', err);
                reject(err);
            });
            archive.on('end', () => {
                console.log('Archive finalization completed');
                resolve(Buffer.concat(chunks));
            });
            archive.finalize();
        });

        console.log('Uploading zip file to S3');
        await s3Client.send(new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: `${username}/${zipFileName}`,
            Body: zipBuffer,
        }));

        // Generate a pre-signed URL for downloading the zip file
        console.log('Generating pre-signed URL');
        const url = await getSignedUrl(s3Client, new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: `${username}/${zipFileName}`,
        }), { expiresIn: 3600 }); // URL expires in 1 hour

        console.log('Sending response with download URL');
        res.status(200).json({ url });

        // Clean up temporary files in S3
        console.log('Cleaning up temporary files');
        await Promise.all([
            s3Client.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: visuraKey })),
            s3Client.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: creditiKey })),
            ...fileList.map(file =>
                s3Client.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: `${username}/${trimExtension(path.basename(file))}Compilato.docx` }))
            )
        ]);

        console.log('API route handler completed successfully');
    } catch (error) {
        console.error('Error in contract compilation:', error);
        res.status(500).json({ error: 'An error occurred during contract compilation.' });
    }
}