import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import PDFParser from 'pdf2json';
import xlsx from 'xlsx';
import { Readable } from 'stream';

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
});

// ... (other helper functions remain the same)

async function extractVisuraInfo(bucket: string, key: string): Promise<Record<string, string>> {
    console.log('Extracting Visura info from:', key);
    const pdfContent = await getS3FileContent(bucket, key);
    // ... (rest of the function remains the same)
    console.log('Visura info extracted successfully');
    return replacements;
}

async function extractCreditiInfo(bucket: string, key: string): Promise<Record<string, number>> {
    console.log('Extracting Crediti info from:', key);
    const xlsxContent = await getS3FileContent(bucket, key);
    // ... (rest of the function remains the same)
    console.log('Crediti info extracted successfully');
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
        console.log('Replacing text in DOCX:', inputKey);
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
        console.log('Contract compilation started for:', inputKey);
        console.log('Extracting Visura info');
        const visuraReplacements = await extractVisuraInfo(visuraBucket, visuraKey);
        console.log('Extracting Crediti info');
        const creditiReplacements = await extractCreditiInfo(creditiBucket, creditiKey);
        const replacements = { ...visuraReplacements, ...creditiReplacements };
        console.log('Replacements prepared:', Object.keys(replacements).length, 'items');
        await replaceTextInDocx(inputBucket, inputKey, outputBucket, outputKey, replacements);
        console.log('Contract compilation completed for:', inputKey);
    } catch (error) {
        console.error('Error compiling contract:', error);
        throw error;
    }
}