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

function removeTrailingNonCapsWords(str) {
    // Split the string into words
    let words = str.split(' ');

    // Remove words from the end while they're not in all caps
    while (words.length > 0 && words[words.length - 1] !== words[words.length - 1].toUpperCase()) {
        words.pop();
    }

    // Join the remaining words back into a string
    return words.join(' ');
}

function extractEmail(text) {
    const pattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    const match = text.match(pattern);
    return match ? match[0] : null;
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
    const end = text.indexOf('PEC')
    return cleanText(removeTrailingNonCapsWords(text.slice(start, end)))
}

function getPec(text: string) {
    const start = text.indexOf('PEC') + 'PEC'.length;
    const end = text.indexOf('Numero');
    return cleanText(extractEmail(text.slice(start, end)));
}

function getPartitaIva(text: string){
    const start = text.indexOf('Partita IVA') + 'Partita IVA'.length;
    const end = text.indexOf('Forma giuridica');
    return cleanText(text.slice(start, end));
}

function getFirstCapitalSubstring(str: string): string {
    let result = '';
    let capitalCount = 0;
    let start = -1;
    let lastCapitalIndex = -1;
    const isAllowedChar = (char: string) => {
        return (char >= '0' && char <= '9')  || char === '(' || char === ')';
    };

    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (char >= 'A' && char <= 'Z') {
            if (start === -1) start = i;
            capitalCount++;
            lastCapitalIndex = i;
        } else if (char === ' ' && lastCapitalIndex === i - 1) {
            // Treat space as part of sequence if it's right after a capital
            continue;
        } else if (isAllowedChar(char) || char == '\n') {
            // Treat numbers, brackets, and escape sequences as part of the sequence
            if (start !== -1)
                continue;
        } else {
            // Check if we have a valid sequence before resetting
            if (capitalCount >= 2) {
                return str.substring(start, i);
            }
            // Reset if we encounter a non-allowed character
            start = -1;
            capitalCount = 0;
            lastCapitalIndex = -1;
        }

        // Check for valid sequence at each step
        if (capitalCount >= 2) {
            result = str.substring(start, i + 1);
        }
    }

    // Handle case where valid sequence goes to the end of the string
    if (capitalCount >= 2 && start !== -1) {
        return str.substring(start);
    }

    return result; // Return the last valid sequence found, or empty string if none
}

function getFirstCapitalSubstringNoSpace(str: string): string {
    let result = '';
    let capitalCount = 0;
    let start = -1;
    let lastCapitalIndex = -1;
    const isAllowedChar = (char: string) => {
        return (char >= '0' && char <= '9')  || char === '(' || char === ')';
    };

    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (char >= 'A' && char <= 'Z') {
            if (start === -1) start = i;
            capitalCount++;
            lastCapitalIndex = i;
        } else if (isAllowedChar(char)) {
            // Treat numbers, brackets, and escape sequences as part of the sequence
            if (start !== -1)
                continue;
        } else {
            // Check if we have a valid sequence before resetting
            if (capitalCount >= 2) {
                return str.substring(start, i);
            }
            // Reset if we encounter a non-allowed character
            start = -1;
            capitalCount = 0;
            lastCapitalIndex = -1;
        }

        // Check for valid sequence at each step
        if (capitalCount >= 2) {
            result = str.substring(start, i + 1);
        }
    }

    // Handle case where valid sequence goes to the end of the string
    if (capitalCount >= 2 && start !== -1) {
        return str.substring(start);
    }

    return result; // Return the last valid sequence found, or empty string if none
}

function getAmministratore(text: string) {
    const start = text.indexOf("Elenco amministratori") + "Elenco amministratori".length
    const end = start + Number.MAX_SAFE_INTEGER;
    let rappresentante = cleanText(getFirstCapitalSubstring(text.slice(start, end)));
    return cleanText(rappresentante.slice(0, -1));
}

function getLuogoDiNascitaRappresentante(text:string) {
    text = text.slice(text.indexOf("Elenco amministratori") + "Elenco amministratori".length);
    let rappresentante = getFirstCapitalSubstring(text)
    text = text.slice(text.indexOf(rappresentante)+rappresentante.length)
    let start = text.indexOf("Nato a") + "Nato a".length
    let end = text.indexOf("il")
    return cleanText(text.slice(start, end))
}

function getDataDiNascitaRappresentante(text:string) {
    text = text.slice(text.indexOf("Elenco amministratori") + "Elenco amministratori".length);
    let rappresentante = getFirstCapitalSubstring(text)
    text = text.slice(text.indexOf(rappresentante)+rappresentante.length)
    let start = text.indexOf("il") + "il".length
    let end = text.indexOf("Codice")
    return cleanText(text.slice(start, end))
}

function getCodiceFiscaleRappresentante(text:string) {
    text = text.slice(text.indexOf("Elenco amministratori") + "Elenco amministratori".length);
    const start = text.indexOf("Codice fiscale:") + "Codice fiscale:".length;
    const end = start + Number.MAX_SAFE_INTEGER
    return cleanText(getFirstCapitalSubstringNoSpace(text.slice(start, end)))
}

function getCittadinanzaRappresentante(text:string) {
    text = text.slice(text.indexOf("Elenco amministratori") + "Elenco amministratori".length);
    text = text.slice(text.indexOf("Codice fiscale: ") + "Codice fiscale: ".length + 17);
    text = cleanText(text.slice(0,1000))
    if(text.startsWith("Paese di cittadinanza")) {
        return cleanText(getFirstCapitalSubstring(text))
    }
    return "ITALIA"
}

function getResidenzaRappresentante(text:string) {
    text = text.slice(text.indexOf("Elenco amministratori") + "Elenco amministratori".length);
    text = text.slice(text.indexOf("Codice fiscale: ") + "Codice fiscale: ".length + 17);
    text = cleanText(text.slice(0,1000))
    if(text.startsWith("Paese di cittadinanza")) {
        let citt = cleanText(getFirstCapitalSubstring(text))
        text = text.slice(text.indexOf(citt)+citt.length)
    }
    let end = text.indexOf('CAP') + 'CAP'.length + 6
    let value = text.slice(0, end)
    return cleanText(removeTrailingNonCapsWords(value))
}

async function extractVisuraInfo(file: string): Promise<Record<string, string>> {

    return new Promise(async (resolve, reject) => {
        const dataBuffer = await readFile(file);
        const data = await pdf(dataBuffer);
        const text = data.text


        const replacements: Record<string, string> = { 'data': getCurrentDate() };
        replacements['società'] = getSocieta(text)
        replacements['sede legale'] = getSedeLegale(text)
        replacements['pec'] = getPec(text)
        replacements['partita iva'] = getPartitaIva(text)
        replacements['rappresentante legale'] = getAmministratore(text)
        replacements['luogo di nascita rappresentante'] = getLuogoDiNascitaRappresentante(text)
        replacements['data di nascita rappresentante'] = getDataDiNascitaRappresentante(text)
        replacements['codice fiscale rappresentante'] = getCodiceFiscaleRappresentante(text)
        replacements['cittadinanza rappresentante'] = getCittadinanzaRappresentante(text)
        replacements['residenza rappresentante'] = getResidenzaRappresentante(text)

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