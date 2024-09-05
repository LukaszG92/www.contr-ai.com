import { NextApiRequest, NextApiResponse } from 'next';
import { S3 } from 'aws-sdk';
import archiver from 'archiver';
import stream from 'stream';
import { promisify } from 'util';
import { contractCompiler, ProcessingContext } from '@/lib/contractCompiler';

// Configure AWS SDK
const s3 = new S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
});

const pipeline = promisify(stream.pipeline);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        // Get the file keys from the query parameters
        const fileKeys = req.query.files as string[];

        if (!fileKeys || fileKeys.length === 0) {
            return res.status(400).json({ message: 'No files specified' });
        }

        // Create a zip archive
        const archive = archiver('zip', {
            zlib: { level: 9 } // Sets the compression level
        });

        // Set the headers for file download
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename=compiled_contracts.zip`);

        // Pipe the archive to the response
        archive.pipe(res);

        let context: ProcessingContext = {};

        // First pass: process PDF and XLSX files
        for (const fileKey of fileKeys) {
            if (fileKey.endsWith('.pdf') || fileKey.endsWith('.xlsx')) {
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
            }
        }

        // Second pass: process and add only DOCX files to the archive
        for (const fileKey of fileKeys) {
            if (fileKey.endsWith('.docx')) {
                const s3Object = await s3.getObject({
                    Bucket: process.env.S3_BUCKET_NAME!,
                    Key: fileKey,
                }).promise();

                if (!s3Object.Body) {
                    throw new Error(`File ${fileKey} not found in S3`);
                }

                const fileContent = s3Object.Body as Buffer;
                const { buffer } = await contractCompiler(fileContent, context);

                // Add only the processed DOCX file to the zip archive
                archive.append(buffer, { name: `compiled_${fileKey}` });
            }
        }

        // Finalize the archive
        await archive.finalize();

    } catch (error) {
        console.error('Error processing files:', error);
        res.status(500).json({ message: 'Error processing files' });
    }
}