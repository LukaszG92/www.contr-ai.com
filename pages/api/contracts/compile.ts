import { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm, Fields, Files, File } from 'formidable';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import archiver from 'archiver';
import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from 'stream';
import { contractCompiler } from '@/lib/contractCompiler';

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

const getFilename = (contractName: string): string => {
    return path.basename(contractName);
};

const getSafeFilename = (file: File | File[] | undefined): string => {
    if (Array.isArray(file)) {
        return file[0]?.originalFilename || 'unnamed_file';
    }
    return file?.originalFilename || 'unnamed_file';
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

        const userDir = path.join(process.cwd(), 'tmp', username);
        await fsPromises.mkdir(userDir, { recursive: true });

        const newVisuraPath = path.join(userDir, getSafeFilename(visuraFile));
        const newCreditiPath = path.join(userDir, getSafeFilename(creditiFile));

        const visuraFilepath = getSafeFilepath(visuraFile);
        const creditiFilepath = getSafeFilepath(creditiFile);

        if (visuraFilepath && creditiFilepath) {
            await fsPromises.copyFile(visuraFilepath, newVisuraPath);
            await fsPromises.copyFile(creditiFilepath, newCreditiPath);
            await fsPromises.unlink(visuraFilepath);
            await fsPromises.unlink(creditiFilepath);
        } else {
            throw new Error('Invalid file paths');
        }

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
        const zipFilePath = path.join(userDir, zipFileName);
        const output = fs.createWriteStream(zipFilePath);
        const archive = archiver('zip', {
            zlib: { level: 9 }
        });

        archive.pipe(output);

        const listParams = {
            Bucket: process.env.S3_BUCKET_NAME,
            Prefix: `${username}/`,
        };

        const listResult = await s3Client.send(new ListObjectsV2Command(listParams));
        const fileList = listResult.Contents?.map(object => object.Key!) ?? [];
        const tmpFiles: string[] = [];

        for (const file of fileList) {
            const getParams = {
                Bucket: process.env.S3_BUCKET_NAME,
                Key: file,
            };

            const { Body } = await s3Client.send(new GetObjectCommand(getParams));
            const compileFilePath = path.join(userDir, path.basename(file));
            await new Promise((resolve, reject) => {
                const writeStream = fs.createWriteStream(compileFilePath);
                (Body as Readable).pipe(writeStream);
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });

            const outputFilePath = path.join(userDir, `${trimExtension(path.basename(file))}Compilato.docx`);
            await contractCompiler(compileFilePath, outputFilePath, newVisuraPath, newCreditiPath);
            archive.file(outputFilePath, { name: getFilename(outputFilePath) });
            tmpFiles.push(outputFilePath);
            tmpFiles.push(compileFilePath);
        }

        await new Promise<void>((resolve, reject) => {
            output.on('close', resolve);
            archive.on('error', reject);
            archive.finalize();
        });

        const zipFileContent = await fsPromises.readFile(zipFilePath);

        // Upload the zip file to S3
        const uploadParams = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: `${username}/${zipFileName}`,
            Body: zipFileContent,
        };

        await s3Client.send(new PutObjectCommand(uploadParams));

        // Generate a pre-signed URL for downloading the zip file
        const url = await getSignedUrl(s3Client, new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: `${username}/${zipFileName}`,
        }), { expiresIn: 3600 }); // URL expires in 1 hour

        res.status(200).json({ url });

        // Clean up temporary files
        await Promise.all([
            fsPromises.unlink(zipFilePath),
            fsPromises.unlink(newVisuraPath),
            fsPromises.unlink(newCreditiPath),
            ...tmpFiles.map(file => fsPromises.unlink(file))
        ]);

    } catch (error) {
        console.error('Errore nella compilazione dei contratti:', error);
        res.status(500).json({ error: 'Si è verificato un errore durante la compilazione del contratto.' });
    }
}