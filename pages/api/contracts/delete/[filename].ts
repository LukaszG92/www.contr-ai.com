// pages/api/contracts/[filename].ts
import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'DELETE') {
        const { filename } = req.query;
        const username = req.headers['x-username'] as string;

        if (!filename || Array.isArray(filename) || !username) {
            return res.status(400).json({ error: 'Invalid filename or username' });
        }

        try {
            const filePath = path.join(process.cwd(), 'uploads', username, filename);
            await fs.unlink(filePath);
            return res.status(200).json({ message: `File ${filename} eliminato correttamente!` });
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                console.error(`File ${filename} non trovato.`);
                return res.status(404).json({ error: `File ${filename} non trovato.` });
            } else {
                console.error(`Si è verificato un errore nella rimozione del file:`, error);
                return res.status(500).json({ error: 'Si è verificato un errore nella rimozione del file.' });
            }
        }
    } else {
        res.setHeader('Allow', ['DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}