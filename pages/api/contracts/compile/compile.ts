import { NextApiRequest, NextApiResponse } from 'next';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { Buffer } from "buffer";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import multiparty from "multiparty";
import { Readable } from 'stream';

function replaceTextInDocx(
    inputBuffer: Buffer,
    replacements: Record<string, string | number>
): Buffer {
    const zip = new PizZip(inputBuffer);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    doc.setData(replacements);
    doc.render();
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

        const replacements = fields.replacements;
        const contract = fields.contract[0];
        const username = fields.username[0];

        console.log(contract);

        // Initialize the S3 client
        const s3Client = new S3Client({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            },
        });

        const command = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
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