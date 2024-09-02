import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs/promises';
import path from 'path';

export const config = {
    api: {
        bodyParser: false,
    },
};

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

        const userDir = path.join(process.cwd(), 'uploads', username);
        await fs.mkdir(userDir, { recursive: true });

        const timestamp = Date.now();
        const originalFilename = file.originalFilename || 'unnamed';
        const newFileName = `${timestamp}-${originalFilename}`;

        const newFilePath = path.join(userDir, newFileName);
        await fs.copyFile(file.filepath, newFilePath);
        await fs.unlink(file.filepath);

        res.status(200).json({ message: 'File caricato con successo!', fileName: newFileName });
    } catch (error) {
        console.error('Errore durante l\'upload del file:', error);
        res.status(500).json({ error: 'Si è verificato un errore durante il caricamento del file.' });
    }
}