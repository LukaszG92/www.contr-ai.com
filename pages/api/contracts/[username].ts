import { NextApiRequest, NextApiResponse } from 'next';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
    region: 'eu-west-3',
    credentials: {
        accessKeyId: 'AKIAU6YXU6JPHNVJSH5J',
        secretAccessKey: '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',
    },
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { username } = req.query;

    if (!username || Array.isArray(username)) {
        return res.status(403).json({
            status: "failure",
            message: "Non è stato inserito un username valido nella richiesta."
        });
    }

    try {
        const listParams = {
            Bucket: 'www.contr-ai.com',
            Prefix: `${username}/`,
        };

        const data = await s3Client.send(new ListObjectsV2Command(listParams));
        const contracts = data.Contents?.map(object => object.Key?.split('/').pop()) ?? [];

        res.status(200).json({
            status: "success",
            message: "Contratti trovati con successo!",
            data: { contratti: contracts }
        });
    } catch (error) {
        console.error('Errore nel recupero dei contratti:', error);
        res.status(500).json({
            status: "failure",
            message: "Si è verificato un errore nel recupero dei contratti."
        });
    }
}