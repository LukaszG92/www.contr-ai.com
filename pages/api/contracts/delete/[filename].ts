// pages/api/contracts/[filename].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'DELETE') {
        const { filename } = req.query;
        const username = req.headers['x-username'] as string;

        if (!filename || Array.isArray(filename) || !username) {
            return res.status(400).json({ error: 'Invalid filename or username' });
        }

        try {
            const key = `${username}/${filename}`;
            await s3Client.send(new DeleteObjectCommand({
                Bucket: process.env.AWS_S3_BUCKET_NAME,
                Key: key,
            }));
            return res.status(200).json({ message: `File ${filename} eliminato correttamente!` });
        } catch (error) {
            console.error(`Si è verificato un errore nella rimozione del file:`, error);
            return res.status(500).json({ error: 'Si è verificato un errore nella rimozione del file.' });
        }
    } else {
        res.setHeader('Allow', ['DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}