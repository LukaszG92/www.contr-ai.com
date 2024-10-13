import {Buffer} from "buffer";
import PDFParser from "pdf2json";
import fs from "fs/promises";
import multiparty from 'multiparty';
import { readFile } from 'fs/promises';
import pdf from 'pdf-parse';
import {NextApiRequest, NextApiResponse} from "next";


function getCurrentDate(): string {
    const date = new Date();
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function removeLastWord(str: string) {
    return str.replace(/\s+\S+$/, '');
}

function cleanText(text: string): string {
    return text.replace(/[\r\n]/g, ' ').trim();
}
function getSocieta(text: string) {
    const start = text.indexOf('CAPITALE') + 'CAPITALE'.length;
    const end = text.indexOf('Il QR ');
    let value = cleanText(text.slice(start, end));
    value = removeLastWord(value)
    return cleanText(value)
}

function getSedeLegale(text: string) {
    const start = text.indexOf('Indirizzo Sede legale') + 'Indirizzo Sede legale'.length;
    const end = text.indexOf('PEC');
    let value = cleanText(text.slice(start, end));
    value = removeLastWord(value)
    return value;
}

function getPec(text: string) {
    const start = text.indexOf('PEC') + 'Domicilio digitale/PEC'.length;
    const end = text.indexOf('Numero');
    return cleanText(text.slice(start, end));
}

function getPartitaIva(text: string){
    const start = text.indexOf('Partita IVA') + 'Partita IVA'.length;
    const end = text.indexOf('Forma giuridica');
    return cleanText(text.slice(start, end));
}

function getFirstCapitalSubstring(str : string) {
    let result = '';
    let isCapitalSequence = false;

    for (let char of str) {
        if ((char >= 'A' && char <= 'Z') || char == ' ' ) {
            result += char;
            isCapitalSequence = true;
        } else if (isCapitalSequence) {
            break;
        }
    }

    return result;
}

function getAmministratore(text: string) {
    const start = text.indexOf('Data ultimo protocollo') + 'Data ultimo protocollo'.length + 15;
    const end = start + Number.MAX_SAFE_INTEGER;
    return cleanText(getFirstCapitalSubstring(text.slice(start, end)));
}

async function extractVisuraInfo(file: string): Promise<Record<string, string>> {

    return new Promise(async (resolve, reject) => {
        const dataBuffer = await readFile(file);
        const data = await pdf(dataBuffer);
        const text = data.text

        console.log("Extracting visura...")

        const replacements: Record<string, string> = { 'data': getCurrentDate() };
        replacements['società'] = getSocieta(text)
        replacements['sede legale'] = getSedeLegale(text)
        replacements['pec'] = getPec(text)
        replacements['partita iva'] = getPartitaIva(text)
        replacements['rappresentante legale'] = getAmministratore(text)

        resolve(replacements);
        });
}

export const config = {
    api: {
        bodyParser: false,
    },
};

interface ParsedForm {
    files: Record<string, any>;
    fields: Record<string, any>;
}


const parseForm = (req: NextApiRequest) => {
    return new Promise((resolve, reject) => {
        const form = new multiparty.Form();

        form.parse(req, (err, fields, files) => {
            if (err) reject(err);
            resolve({ fields, files });
        });
    });
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { files } = await parseForm(req) as ParsedForm;
        const visuraFile = files.visura[0].path;
        const visuraReplacements = await extractVisuraInfo(visuraFile);

        res.status(200).json({ message: 'Dati della visura ottenuti con successo', replacements: visuraReplacements });
    } catch (error) {
        console.error('Error processing upload:', error);
        res.status(500).json({ error: 'Error processing upload' });
    }
}