import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import PDFParser from 'pdf2json';
import xlsx from 'xlsx';


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

async function extractVisuraInfo(pdfBuffer: Buffer): Promise<Record<string, string>> {
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
        const pdfParser = new PDFParser(null, true); // Changed from 1 to true

        pdfParser.on("pdfParser_dataError", (errData) => {
            reject(new Error('PDF parsing failed: ' + errData.parserError));
        });

        pdfParser.on("pdfParser_dataReady", () => {
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

        pdfParser.parseBuffer(pdfBuffer);
    });
}

function extractCreditiInfo(xlsxBuffer: Buffer): Record<string, number> {
    const workbook = xlsx.read(xlsxBuffer, { type: 'buffer' });
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
    docxBuffer: Buffer,
    replacements: Record<string, string | number>
): Promise<Buffer> {
    const zip = new PizZip(docxBuffer);
    const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
    });

    doc.setData(replacements);
    doc.render();

    return doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
    });
}

function determineFileType(buffer: Buffer): string {
    const header = buffer.slice(0, 4).toString('hex');
    if (header === '504b0304') return 'docx'; // DOCX files start with PK..
    if (header === '25504446') return 'pdf';  // PDF files start with %PDF
    if (header === 'd0cf11e0') return 'xlsx'; // Old Excel files
    if (header === '504b0304') return 'xlsx'; // New Excel files (same as DOCX, need more sophisticated check)
    throw new Error('Unknown file type');
}

export interface ProcessingContext {
    visuraInfo?: Record<string, string>;
    creditiInfo?: Record<string, number>;
    docxBuffer?: Buffer;
}

export async function contractCompiler(fileBuffer: Buffer, context: ProcessingContext = {}): Promise<{ buffer: Buffer; context: ProcessingContext }> {
    try {
        const fileType = determineFileType(fileBuffer);

        switch (fileType) {
            case 'pdf':
                context.visuraInfo = await extractVisuraInfo(fileBuffer);
                return { buffer: fileBuffer, context };
            case 'xlsx':
                context.creditiInfo = extractCreditiInfo(fileBuffer);
                return { buffer: fileBuffer, context };
            case 'docx':
                context.docxBuffer = fileBuffer;
                if (context.visuraInfo && context.creditiInfo) {
                    const replacements = { ...context.visuraInfo, ...context.creditiInfo };
                    const processedBuffer = await replaceTextInDocx(fileBuffer, replacements);
                    return { buffer: processedBuffer, context: {} }; // Clear context after processing
                }
                return { buffer: fileBuffer, context }; // Return original if not all info is available
            default:
                throw new Error('Unsupported file type');
        }
    } catch (error) {
        console.error('Error in contractCompiler:', error);
        throw error;
    }
}