import {Buffer} from "buffer";
import PDFParser from "pdf2json";
import fs from "fs/promises";
import multiparty from 'multiparty';
import { readFile } from 'fs/promises';
import pdf from 'pdf-parse';


function getCurrentDate(): string {
    const date = new Date();
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function findRepeatingSubstring(str: string): string {
    if (str.length === 0) return str;
    for (let i = 1; i <= str.length / 2; i++) {
        if (str.length % i === 0) {
            const substring = str.slice(0, i);
            if (substring.repeat(str.length / i) === str) return substring;
        }
    }
    return str;
}

function cleanText(text: string): string {
    return text.replace(/\r\n/g, ' ').trim();
}

async function extractVisuraInfo(file: string): Promise<Record<string, string>> {
    const info = [
        'CAPITALE', 'Il QR ', 'Indirizzo Sede legale', 'Domicilio digitale/PEC',
        'Numero REARM - ', 'Codice fiscale e n.iscr. al\nRegistro Imprese\n',
        'Partita IVA', 'Forma giuridica', 'Data atto di costituzione',
        'Data iscrizione', 'Data ultimo protocollo', 'Amministratore Unico', 'Rappresentante'
    ];
    const fieldNames = [
        'società', '', 'sede legale', 'pec', 'rearm', 'codice fiscale',
        'partita iva', 'forma giuridica', 'data costituzione', 'data iscrizione',
        'data ultimo protocollo', 'amministratore unico'
    ];

    return new Promise(async (resolve, reject) => {
        const dataBuffer = await readFile(file);
        const data = await pdf(dataBuffer);
        const text = data.text

        const replacements: Record<string, string> = { 'data odierna': getCurrentDate() };
        for (let i = 0; i < info.length - 1; i++) {
            if (i !== 1 && i !== 12) {
                const start = text.indexOf(info[i]) + info[i].length;
                const end = text.indexOf(info[i + 1]);
                const value = cleanText(text.slice(start, end));
                replacements[fieldNames[i]] = i === 0 ? value.slice(0, value.lastIndexOf(' ')) : findRepeatingSubstring(value);
            }
        }
        resolve(replacements);
        });
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
        const visuraFile = files.visura[0].path;
        const visuraReplacements = await extractVisuraInfo(visuraFile);

        res.status(200).json({ message: 'Dati della visura ottenuti con successo', replacements: visuraReplacements });
    } catch (error) {
        console.error('Error processing upload:', error);
        res.status(500).json({ error: 'Error processing upload' });
    }
}