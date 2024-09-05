import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import PDFParser from 'pdf2json';
import xlsx from 'xlsx';
import { Readable } from 'stream';

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'eu-west-3',
});

function getCurrentDate(): string {
    const date = new Date();
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function findRepeatingSubstring(str: string): string {
    if (str.length === 0) {
        return str;
    }

    for (let i = 1; i <= str.length / 2; i++) {
        if (str.length % i === 0) {
            const substring = str.slice(0, i);
            if (substring.repeat(str.length / i) === str) {
                return substring;
            }
        }
    }

    return str;
}

function cleanText(text: string): string {
    return text.replace(/\r\n/g, ' ').trim();
}

async function getS3FileContent(bucket: string, key: string): Promise<Buffer> {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await s3Client.send(command);
    return streamToBuffer(response.Body as Readable);
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: any[] = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
}

async function extractVisuraInfo(bucket: string, key: string): Promise<Record<string, string>> {
    const pdfContent = await getS3FileContent(bucket, key);
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
        const pdfParser = new PDFParser();

        pdfParser.on("pdfParser_dataError", (error) => {
            reject(new Error('PDF parsing failed: ' + error));
        });

        pdfParser.on("pdfParser_dataReady", (pdfData) => {
            const text = pdfParser.getRawTextContent();
            const replacements: Record<string, string> = {
                'data odierna': getCurrentDate()
            };

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

        pdfParser.parseBuffer(pdfContent);
    });
}

async function extractCreditiInfo(bucket: string, key: string): Promise<Record<string, number>> {
    const xlsxContent = await getS3FileContent(bucket, key);
    const workbook = xlsx.read(xlsxContent, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const sheetData = xlsx.utils.sheet_to_json(worksheet);

    let sums = new Map<string, number>();
    sheetData.forEach((row: any) => {
        if (String(row['__EMPTY_12']).includes('cedibile a chiunque')) {
            const key = 'Crediti' + row['__EMPTY_4'];
            sums.set(key, (sums.get(key) || 0) + row['__EMPTY_5']);
        }
    });

    return Object.fromEntries(sums);
}

async function replaceTextInDocx(
    inputBucket: string,
    inputKey: string,
    outputBucket: string,
    outputKey: string,
    replacements: Record<string, string | number>
): Promise<void> {
    try {
        const content = await getS3FileContent(inputBucket, inputKey);
        const zip = new PizZip(content);
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
        });

        doc.setData(replacements);
        doc.render();

        const buf = doc.getZip().generate({
            type: 'nodebuffer',
            compression: 'DEFLATE',
        });

        await s3Client.send(new PutObjectCommand({
            Bucket: outputBucket,
            Key: outputKey,
            Body: buf,
        }));

        console.log(`Text replaced and saved to s3://${outputBucket}/${outputKey}`);
    } catch (err) {
        console.error('Error processing the DOCX file:', err);
        throw err;
    }
}

export async function contractCompiler(
    inputBucket: string,
    inputKey: string,
    outputBucket: string,
    outputKey: string,
    visuraBucket: string,
    visuraKey: string,
    creditiBucket: string,
    creditiKey: string
): Promise<void> {
    try {
        const visuraReplacements = await extractVisuraInfo(visuraBucket, visuraKey);
        const creditiReplacements = await extractCreditiInfo(creditiBucket, creditiKey);
        const replacements = { ...visuraReplacements, ...creditiReplacements };
        await replaceTextInDocx(inputBucket, inputKey, outputBucket, outputKey, replacements);
    } catch (error) {
        console.error('Error compiling contract:', error);
        throw error;
    }
}