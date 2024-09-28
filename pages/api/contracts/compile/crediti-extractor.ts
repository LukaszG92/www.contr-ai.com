import {Buffer} from "buffer";
import xlsx from "xlsx";
import fs from "fs/promises";
import multiparty from "multiparty";

function extractCreditiInfo(file: string): Record<string, number> {
    const workbook = xlsx.readFile(file);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const sheetData = xlsx.utils.sheet_to_json(worksheet);

    const sums = new Map<string, number>();
    sheetData.forEach((row: any) => {
        if (String(row['__EMPTY_12']).includes('cedibile a chiunque')) {
            const key = 'Crediti' + row['__EMPTY_4'];
            sums.set(key, (sums.get(key) || 0) + row['__EMPTY_5']);
        }
    });
    return Object.fromEntries(sums);
}

export const config = {
    api: {
        bodyParser: false,
    },
};

const parseForm = (req) => {
    return new Promise((resolve, reject) => {
        const form = new multiparty.Form();

        form.parse(req, (err, fields, files) => {
            if (err) reject(err);
            resolve({ fields, files });
        });
    });
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { files } = await parseForm(req);
        const creditiFile = files.crediti[0].path;
        const creditiReplacements = await extractCreditiInfo(creditiFile);

        res.status(200).json({ message: 'Dati della visura ottenuti con successo', replacements: creditiReplacements });
    } catch (error) {
        console.error('Error processing upload:', error);
        res.status(500).json({ error: 'Error processing upload' });
    }
}