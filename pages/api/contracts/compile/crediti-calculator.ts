import multiparty from "multiparty";
import {NextApiRequest, NextApiResponse} from "next";
import {list} from "postcss";


function formatNumber(number: number) {
    // Convert the number to a fixed 2 decimal places string
    let numStr = number.toFixed(2);

    // Split the integer and decimal parts
    let [intPart, decPart] = numStr.split('.');

    // Reverse the integer part to easily group digits
    let reversed = intPart.split('').reverse().join('');

    // Group every 3 digits
    let grouped = reversed.match(/.{1,3}/g)?.join('.');

    if(grouped)
        // Reverse back and join with the decimal part
        return grouped.split('').reverse().join('') + ',' + decPart;
}

function numeroInParole(numero: number):string {
    if (isNaN(numero)) return 'Non è un numero valido';

    let [parteIntera, parteDecimale] = numero.toString().split('.');
    let risultato = formatNumber(numero) + ', (';

    // Converti la parte intera in parole
    risultato += convertiInteroInParole(parseInt(parteIntera));

    // Aggiungi la parte decimale se esiste
    if (parteDecimale) {
        risultato += ' virgola ';
        risultato += convertiInteroInParole(parseInt(parteDecimale)) ;
    }

    return risultato.trim() + ')';
}

// Funzione per convertire la parte intera del numero
function convertiInteroInParole(numero: number):string {
    const unita = ['zero', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove'];
    const decine = ['dieci', 'undici', 'dodici', 'tredici', 'quattordici', 'quindici', 'sedici', 'diciassette', 'diciotto', 'diciannove'];
    const decinePiene = ['venti', 'trenta', 'quaranta', 'cinquanta', 'sessanta', 'settanta', 'ottanta', 'novanta'];
    const centinaia = ['cento'];

    if (numero < 10) {
        return unita[numero];
    } else if (numero < 20) {
        return decine[numero - 10];
    } else if (numero < 100) {
        let unit = numero % 10;
        let decina = Math.floor(numero / 10);
        let parola = decinePiene[decina - 2];
        if (unit === 1 || unit === 8) {
            parola = parola.slice(0, -1); // Elimina l'ultima vocale per "ventuno" o "ventotto"
        }
        return parola + (unit !== 0 ? unita[unit] : '');
    } else if (numero < 1000) {
        let centinaio = Math.floor(numero / 100);
        let resto = numero % 100;
        let parola = (centinaio > 1 ? unita[centinaio] : '') + centinaia[0];
        return parola + (resto !== 0 ? convertiInteroInParole(resto) : '');
    } else {
        // Gestione per numeri superiori a 999 (migliaia, milioni, ecc.)
        return convertiNumeriGrandi(numero);
    }
}

// Funzione per gestire numeri superiori a 999
function convertiNumeriGrandi(numero:number):string {
    const migliaia = ['mille', 'mila'];
    const milioni = ['milione', 'milioni'];
    const miliardi = ['miliardo', 'miliardi'];
    const ordini = [1000000000, 1000000, 1000]; // Ordine: miliardi, milioni, migliaia
    let risultato = '';

    for (let i = 0; i < ordini.length; i++) {
        if (numero >= ordini[i]) {
            let unitàOrdine = Math.floor(numero / ordini[i]);
            numero = numero % ordini[i];

            if (i === 2) { // Mille / Mila
                risultato += (unitàOrdine === 1 ? migliaia[0] : convertiInteroInParole(unitàOrdine) +  migliaia[1]);
            } else if (i === 1) { // Milione / Milioni
                risultato += (unitàOrdine === 1 ? milioni[0] : convertiInteroInParole(unitàOrdine) + milioni[1]);
            } else if (i === 0) { // Miliardo / Miliardi
                risultato += (unitàOrdine === 1 ? miliardi[0] : convertiInteroInParole(unitàOrdine) + miliardi[1]);
            }
        }
    }

    if (numero > 0) risultato += convertiInteroInParole(numero);
    return risultato.trim();
}

function extractCreditiInfo(sums: Map<string, number>, percentualeCessione: number, percentualiConsulenza: number[]): {
    [p: string]: string
} {

    let calcoli: Map<string, string> = new Map<string, string>;
    let creditiTotale = 0
    let scontoTotale = 0
    let commissioneConsulenza = 0
    let nettoTotale = 0
    let commissioniTotaliConsulenti:number[] = []
    percentualiConsulenza.forEach((value, index, array) => {
        commissioniTotaliConsulenti[index] = 0
    })
    sums.forEach( (value, key, map) => {
        let year = key;
        console.log(value, key)
        calcoli.set('crediti'+key, numeroInParole(Number(value.toFixed(2))).toUpperCase())
        creditiTotale += value

        let sconto = value * (percentualeCessione/100)
        calcoli.set('sconto'+year, numeroInParole(Number(sconto.toFixed(2))).toUpperCase())
        scontoTotale += sconto

        let counter = 1
        let commissioniCAnnue = 0
        percentualiConsulenza.forEach((percentuale, index, array) => {
            let commissioneC = value * (percentuale / 100) * 1.22
            calcoli.set('commissione consulenza' + year + ` ${counter}`, numeroInParole(Number(commissioneC.toFixed(2))).toUpperCase())
            commissioniCAnnue += commissioneC
            commissioneConsulenza += commissioneC
            commissioniTotaliConsulenti[index] += commissioneC
            console.log(commissioniTotaliConsulenti)
            counter++

            let netto = sconto - commissioneC
            nettoTotale += netto
            calcoli.set('netto' + year, numeroInParole(Number(netto.toFixed(2))).toUpperCase())
            calcoli.set('commissioni consulenti'+year, numeroInParole(Number(commissioniCAnnue.toFixed(2))).toUpperCase())
        })
        /*let commissioneC = value * (percentualeConsulenza / 100) * 1.22
        calcoli.set('commissione consulenza' + year, numeroInParole(Number(commissioneC.toFixed(2))).toUpperCase())
        commissioneConsulenza += commissioneC

        let netto = sconto - commissioneC
        nettoTotale += netto
        calcoli.set('netto' + year, numeroInParole(Number(netto.toFixed(2))).toUpperCase())*/

        commissioniTotaliConsulenti.forEach((value, index, array) => {
            calcoli.set('commissione consulente'+(index+1), numeroInParole(Number(value.toFixed(2))).toUpperCase())
        })

        calcoli.set('crediti', numeroInParole(Number(creditiTotale.toFixed(2).toUpperCase())))
        calcoli.set('sconto', numeroInParole(Number(scontoTotale.toFixed(2))).toUpperCase())
        //calcoli.set('commissione revisione', numeroInParole(Number(commissioneRevisione.toFixed(2))).toUpperCase())
        calcoli.set('commissione consulenza', numeroInParole(Number(commissioneConsulenza.toFixed(2))).toUpperCase())
        calcoli.set('netto', numeroInParole(Number(nettoTotale.toFixed(2))).toUpperCase())
    })

    return Object.fromEntries(calcoli)
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
        const { files, fields} = await parseForm(req) as ParsedForm;
        const crediti = JSON.parse(fields.crediti[0]);

        let map = new Map<string, number>
        for (const anno in crediti) {
            map.set(anno, Number(crediti[anno]))
        }

        const percentualeCessione = Number(fields.percentuale_cessione[0]);
        const percentualeConsulenza = fields.percentuali_consulenza[0];
        let percentualiConsulenza = percentualeConsulenza.split(',')

        const creditiReplacements = extractCreditiInfo(map, percentualeCessione, percentualiConsulenza);

        res.status(200).json({ message: 'Dati della visura ottenuti con successo', replacements: creditiReplacements });
    } catch (error) {
        console.error('Error processing upload:', error);
        res.status(500).json({ error: 'Error processing upload' });
    }
}