import { NextApiRequest, NextApiResponse } from 'next';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
    region: 'eu-west-3',
    credentials: {
        accessKeyId: 'AKIAU6YXU6JPHNVJSH5J',
        secretAccessKey: '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',
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
            const deleteParams = {
                Bucket: 'www.contr-ai.com',
                Key: `${username}/${filename}`,
            };

            await s3Client.send(new DeleteObjectCommand(deleteParams));
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