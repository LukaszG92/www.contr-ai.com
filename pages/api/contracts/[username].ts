import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';

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
        const contractsDir = path.join(process.cwd(), 'uploads', username);
        let contracts = await fs.readdir(contractsDir);
        console.log(contractsDir)
        console.log(contracts)
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