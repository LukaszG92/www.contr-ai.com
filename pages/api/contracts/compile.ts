import { NextApiRequest, NextApiResponse } from 'next';
import {IncomingForm, Fields, Files, File} from 'formidable';
import path from 'path';
import archive from 'simple-archiver';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import PDFParser from 'pdf2json';
import xlsx from 'xlsx';
import {Buffer} from "buffer";
import * as buffer from "buffer";
import {GetObjectCommand, ListObjectsV2Command, S3Client} from "@aws-sdk/client-s3";
import fs from "fs/promises";

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

function getCurrentDate(): string {
    const date = new Date();
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

const getSafeFilepath = (file: File | File[] | undefined): string => {
    return Array.isArray(file) ? file[0]?.filepath || '' : file?.filepath || '';
};

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

async function extractVisuraInfo(file: Buffer): Promise<Record<string, string>> {
    const info = [
        'CAPITALE', 'Il QR ', 'Indirizzo Sede legale', 'Domicilio digitale/PEC',
        'Numero REARM - ', 'Codice fiscale e n.iscr. al\r\nRegistro Imprese',
        'Partita IVA', 'Forma giuridica', 'Data atto di costituzione',
        'Data iscrizione', 'Data ultimo protocollo', 'Amministratore Unico', 'Rappresentante'
    ];
    const fieldNames = [
        'società', '', 'sede legale', 'pec', 'rearm', 'codice fiscale',
        'partita iva', 'forma giuridica', 'data costituzione', 'data iscrizione',
        'data ultimo protocollo', 'amministratore unico'
    ];

    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser(null);
        pdfParser.on("pdfParser_dataError", () => reject(new Error('PDF parsing failed')));
        pdfParser.on("pdfParser_dataReady", () => {
            const text = pdfParser.getRawTextContent();
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
        pdfParser.parseBuffer(file);
    });
}

function extractCreditiInfo(file: Buffer): Record<string, number> {
    const workbook = xlsx.read(file);
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

function replaceTextInDocx(
    inputBuffer: Buffer,
    replacements: Record<string, string | number>
): Buffer {
    const zip = new PizZip(inputBuffer);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    doc.setData(replacements);
    doc.render();
    return <Buffer>doc.getZip().generate({type: 'nodebuffer', compression: 'DEFLATE'});
}

async function contractCompiler(
    inputBuffer: Buffer,
    visuraBuffer: Buffer,
    creditiBuffer: Buffer
): Promise<Buffer> {
    const visuraReplacements = await extractVisuraInfo(visuraBuffer);
    const creditiReplacements = await extractCreditiInfo(creditiBuffer);
    const replacements = { ...visuraReplacements, ...creditiReplacements };
    return replaceTextInDocx(inputBuffer, replacements);
}

const trimExtension = (contractName: string): string => {
    const suffix = '.docx';
    return contractName.endsWith(suffix) ? contractName.slice(0, -suffix.length) : contractName;
};

const getFilename = (contractName: string): string => path.basename(contractName);

const ensureString = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
    return '';
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const form = new IncomingForm();
        const [fields, files] = await new Promise<[Fields, Files]>((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err) reject(err);
                resolve([fields, files]);
            });
        });

        const username = ensureString(fields.username);
        const percentuale = ensureString(fields.percentuale);
        const visuraFile = files.visura;
        const creditiFile = files.crediti;

        if (!visuraFile || !creditiFile) {
            return res.status(400).json({ error: 'I file Visura e Crediti sono richiesti.' });
        }

        let visuraBuffer = await fs.readFile(getSafeFilepath(visuraFile))
        let creditiBuffer = await fs.readFile(getSafeFilepath(creditiFile))

        const customReplacements: Record<string, Record<string, string>> = {};
        Object.entries(fields).forEach(([key, value]) => {
            const match = key.match(/customReplacement\[(\d+)]\[(\w+)]/);
            if (match) {
                const [, index, field] = match;
                if (!customReplacements[index]) customReplacements[index] = {};
                customReplacements[index][field] = ensureString(value);
            }
        });

        const listParams = {
            Bucket: process.env.S3_BUCKET_NAME,
            Prefix: `${username}/`,
        };
        let listCommand = new ListObjectsV2Command(listParams)
        const data = await s3Client.send(listCommand);
        const contracts = data.Contents?.map(object => object.Key) ?? [];

        let archiveData:any[] = []
        const compilationPromises = await contracts.map(async (key) => {
            let getParams = {
                Bucket: process.env.S3_BUCKET_NAME,
                Key: `${key}`,
            };
            const getCommand = new GetObjectCommand(getParams);
            const response = await s3Client.send(getCommand);
            if(response.Body) {
                let buffer = await response.Body.transformToString()
                let reader = new FileReader()
                let compiledBuffer = await contractCompiler(Buffer.from(buffer), visuraBuffer, creditiBuffer);
                archiveData.push({data: compiledBuffer, type: buffer, name: key?.split('/').pop()})
            }
        });

        let archiveBuffer = await archive.archive(archiveData)

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename=${username}Compilato`);
        res.status(200).send(archiveBuffer);

    } catch (error) {
        console.error('Errore nella compilazione dei contratti:', error);
        res.status(500).json({ error: 'Si è verificato un errore durante la compilazione del contratto.' });
    }
}