import { NextApiRequest, NextApiResponse } from 'next';
import { S3 } from 'aws-sdk';
import archiver from 'archiver';
import stream from 'stream';
import { promisify } from 'util';
import { contractCompiler, ProcessingContext } from '@/lib/contractCompiler';

const s3 = new S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
});

const pipeline = promisify(stream.pipeline);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const archive = archiver('zip', {
        zlib: { level: 9 }
    });

    archive.on('error', (err) => {
        console.error('Archive error:', err);
        res.status(500).json({ message: 'Error creating archive' });
    });

    res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename=compiled_contracts.zip'
    });

    archive.pipe(res);

    try {
        const fileKeys = req.query.files as string[];
        if (!fileKeys || fileKeys.length === 0) {
            throw new Error('No files specified');
        }

        console.log('Processing files:', fileKeys);

        let context: ProcessingContext = {};

        // First pass: process PDF and XLSX files
        for (const fileKey of fileKeys) {
            if (fileKey.endsWith('.pdf') || fileKey.endsWith('.xlsx')) {
                console.log(`Processing ${fileKey}`);
                const s3Object = await s3.getObject({
                    Bucket: process.env.S3_BUCKET_NAME!,
                    Key: fileKey,
                }).promise();

                if (!s3Object.Body) {
                    throw new Error(`File ${fileKey} not found in S3`);
                }

                const fileContent = s3Object.Body as Buffer;
                const { context: newContext } = await contractCompiler(fileContent, context);
                context = newContext;
                console.log(`Processed ${fileKey}, updated context`);
            }
        }

        // Second pass: process and add only DOCX files to the archive
        for (const fileKey of fileKeys) {
            if (fileKey.endsWith('.docx')) {
                console.log(`Processing DOCX file: ${fileKey}`);
                const s3Object = await s3.getObject({
                    Bucket: process.env.S3_BUCKET_NAME!,
                    Key: fileKey,
                }).promise();

                if (!s3Object.Body) {
                    throw new Error(`File ${fileKey} not found in S3`);
                }

                const fileContent = s3Object.Body as Buffer;
                const { buffer } = await contractCompiler(fileContent, context);

                archive.append(buffer, { name: `compiled_${fileKey}` });
                console.log(`Added compiled ${fileKey} to archive`);
            }
        }

        console.log('Finalizing archive');
        await archive.finalize();
        console.log('Archive finalized');

    } catch (error) {
        console.error('Error processing files:', error);
        archive.abort();
        res.status(500).json({ message: 'Error processing files' });
    }
}