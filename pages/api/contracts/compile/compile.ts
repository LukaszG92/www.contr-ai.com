import { NextApiRequest, NextApiResponse } from 'next';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { Buffer } from "buffer";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import multiparty from "multiparty";
import { Readable } from 'stream';

function replaceTextInDocx(
    inputBuffer: Buffer,
    replacements: string
): Buffer {
    const zip = new PizZip(inputBuffer);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    doc.render(JSON.parse(replacements));
    return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;
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

const parseForm = (req: NextApiRequest): Promise<ParsedForm> => {
    return new Promise((resolve, reject) => {
        const form = new multiparty.Form();
        form.parse(req, (err, fields, files) => {
            if (err) reject(err);
            resolve({ fields, files });
        });
    });
};

async function streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on('error', (err) => reject(err));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { fields } = await parseForm(req) as ParsedForm;

        const replacements = fields.replacements[0];
        const contract = fields.contract[0];
        const username = fields.username[0];

        // Initialize the S3 client
        const s3Client = new S3Client({
            region: 'eu-west-3',
            credentials: {
                accessKeyId: 'AKIAU6YXU6JPHNVJSH5J',
                secretAccessKey: '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',
            },
        });

        const command = new GetObjectCommand({
            Bucket: 'www.contr-ai.com',
            Key: `${username}/${contract}`,
        });

        const response = await s3Client.send(command);

        if (response.Body instanceof Readable) {
            const fileBuffer = await streamToBuffer(response.Body);
            let compiledBuffer = replaceTextInDocx(fileBuffer, replacements);

            res.status(200).json({ message: 'Contratto compilato con successo', data: {
                    contract: compiledBuffer,
                    filename: contract
                } });
        } else {
            throw new Error("Response body is not a readable stream");
        }
    } catch (error) {
        console.error('Errore nella compilazione dei contratti:', error);
        res.status(500).json({ error: 'Si è verificato un errore durante la compilazione del contratto.' });
    }
}