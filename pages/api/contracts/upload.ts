import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const form = formidable();
        const [fields, files] = await form.parse(req);

        const username = fields.username?.[0];
        const file = files.file?.[0];

        if (!file || !username) {
            return res.status(400).json({ error: 'Nessun file caricato o nome utente mancante.' });
        }

        const timestamp = Date.now();
        const originalFilename = file.originalFilename || 'unnamed';
        const newFileName = `${username}/${timestamp}-${originalFilename}`;

        const fileContent = await fs.readFile(file.filepath);

        const uploadParams = {
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: newFileName,
            Body: fileContent,
        };

        await s3Client.send(new PutObjectCommand(uploadParams));

        res.status(200).json({ message: 'File caricato con successo!', fileName: newFileName });
    } catch (error) {
        console.error('Errore durante l\'upload del file:', error);
        res.status(500).json({ error: 'Si è verificato un errore durante il caricamento del file.' });
    }
}