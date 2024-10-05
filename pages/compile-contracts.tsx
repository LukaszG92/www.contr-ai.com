import {useState, ChangeEvent, FormEvent, useEffect} from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Loader2, Plus} from 'lucide-react'
import Topbar from "@/components/Topbar"
import { saveAs } from 'file-saver'
import {withAuth} from "@/components/withAuth";
import JSZip from 'jszip';

interface CustomReplacement {
    placeholder: string
    replacement: string
}

const CompileContractsPage = () => {
    const currentYear = new Date().getFullYear()

    const [loading, setLoading] = useState<boolean>(false)
    const [contracts, setContracts] = useState<string[]>([])
    const [visura, setVisura] = useState<File | null>(null)
    const [crediti, setCrediti] = useState<File | null>(null)
    const [percentualeCessione, setPercentualeCessione] = useState<string>('0')
    const [percentualeRevisione, setPercentualeRevisione] = useState<string>('0')
    const [percentualeConsulenza, setPercentualeConsulenza] = useState<string>('0')
    const [iban, setIban] = useState<string>('')
    const [customReplacements, setCustomReplacements] = useState<CustomReplacement[]>([{ placeholder: '', replacement: '' }])
    const [startYear, setStartYear] = useState<number>(currentYear)
    const [endYear, setEndYear] = useState<number>(currentYear)

    useEffect(() => {
        const getContracts = async () => {
            const username = localStorage.getItem('username')
            if (!username) {
                console.error('Username not found in localStorage')
                return
            }

            try {
                const response = await fetch(`/api/contracts/${username}`)
                if (response.ok) {
                    const responseData = await response.json()
                    setContracts(responseData.data.contratti)
                } else {
                    throw new Error('Failed to fetch contracts')
                }
            } catch (error) {
                console.error('Error fetching contracts:', error)
            }
        }
        getContracts()
    }, [])

    const handleVisuraChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type === 'application/pdf') {
            setVisura(file);
        } else {
            alert('Per favore, seleziona un file PDF per la Visura.');
            e.target.value = '';
        }
    };

    const handleCreditiChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.name.endsWith('.xlsx')) {
            setCrediti(file);
        } else {
            alert('Per favore, seleziona un file XLSX per i Crediti.');
            e.target.value = '';
        }
    };

    const handlePercentualeCessioneChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value === '' || (Number(value) >= 0 && Number(value) <= 100)) {
            setPercentualeCessione(value);
        }

    };

    const handleIbanChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setIban(value);
    };

    const handlePercentualeRevisioneChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value === '' || (Number(value) >= 0 && Number(value) <= 100)) {
            setPercentualeRevisione(value);
        }
    };

    const handlePercentualeConsulenzaChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value === '' || (Number(value) >= 0 && Number(value) <= 100)) {
            setPercentualeConsulenza(value);
        }
    };

    const handleCustomReplacementChange = (index: number, field: keyof CustomReplacement, value: string) => {
        const updatedReplacements = [...customReplacements];
        updatedReplacements[index][field] = value;
        setCustomReplacements(updatedReplacements);
    };

    const handleStartYearChange = (value: string) => {
        const newStartYear = parseInt(value)
        setStartYear(newStartYear)
        if (newStartYear > endYear) {
            setEndYear(newStartYear)
        }
    }

    const handleEndYearChange = (value: string) => {
        const newEndYear = parseInt(value)
        setEndYear(newEndYear)
        if (newEndYear <= startYear) {
            setStartYear(newEndYear)
        }
    }

    const yearOptions = Array.from({length: 11}, (_, i) => currentYear + i)

    const addCustomReplacement = () => {
        if (customReplacements[customReplacements.length - 1].placeholder &&
            customReplacements[customReplacements.length - 1].replacement) {
            setCustomReplacements([...customReplacements, { placeholder: '', replacement: '' }]);
        } else {
            alert('Per favore, compila entrambi i campi dell\'ultima sostituzione prima di aggiungerne una nuova.');
        }
    };

    function numeroInLettere(n: number): string {
        const numeri: { [key: number]: string } = {
            1: "uno", 2: "due", 3: "tre", 4: "quattro", 5: "cinque", 6: "sei", 7: "sette", 8: "otto", 9: "nove", 10: "dieci",
            11: "undici", 12: "dodici", 13: "tredici", 14: "quattordici", 15: "quindici", 16: "sedici", 17: "diciassette",
            18: "diciotto", 19: "diciannove", 20: "venti", 30: "trenta", 40: "quaranta", 50: "cinquanta", 60: "sessanta",
            70: "settanta", 80: "ottanta", 90: "novanta", 100: "cento"
        };

        if (n in numeri) {
            return numeri[n];
        }

        let decina = Math.floor(n / 10) * 10;
        let unita = n % 10;


        if (unita === 1 || unita === 8) {
            // Se il numero termina in 1 o 8, si elimina la vocale finale della decina (es: ventuno, ventotto)
            return numeri[decina].slice(0, -1) + numeri[unita];
        } else {
            return numeri[decina] + numeri[unita];
        }
    }


    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        if (visura && crediti) {
            try {
                let formData = new FormData()
                formData.append('visura', visura)

                let response = await fetch('/api/contracts/compile/visura-extractor', {
                    method: 'POST',
                    body: formData
                }as RequestInit)

                let responseJson = await response.json()
                let visuraReplacements = responseJson.replacements


                formData = new FormData()
                formData.append('crediti', crediti)
                formData.append('percentuale_cessione', `${percentualeCessione}`)
                formData.append('percentuale_revisione', `${percentualeRevisione}`)
                formData.append('percentuale_consulenza', `${percentualeConsulenza}`)
                formData.append('anno_iniziale', String(startYear))
                formData.append('anno_finale', String(endYear))

                response = await fetch('/api/contracts/compile/crediti-extractor', {
                    method: 'POST',
                    body: formData
                }as RequestInit)

                responseJson = await response.json()
                let creditiReplacements = responseJson.replacements

                let replacements = {
                    ...creditiReplacements,
                    ...visuraReplacements,
                    'percentuale cessione': `${percentualeCessione}% (${numeroInLettere(Number(percentualeCessione))}) `,
                    'percentuale revisione': `${percentualeRevisione}% (${numeroInLettere(Number(percentualeRevisione))}) `,
                    'percentuale consulenza': `${percentualeConsulenza}% (${numeroInLettere(Number(percentualeConsulenza))}) `,
                    'iban': iban
                }

                customReplacements.forEach(elem => {
                    replacements[elem.placeholder] = elem.replacement
                })

                const username = localStorage.getItem('username')
                if (!username) {
                    console.error('Username not found in localStorage')
                    return
                }

                // Create a new JSZip instance
                const zip = new JSZip();

                // Compile each contract and add to zip
                for (const contract of contracts) {
                    formData = new FormData();
                    formData.append('contract', contract);
                    formData.append('replacements', JSON.stringify(replacements));
                    formData.append('username', username);

                    response = await fetch('/api/contracts/compile/compile', {
                        method: 'POST',
                        body: formData
                    } as RequestInit);

                    // Check if the response is successful
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    // Parse the JSON response
                    const responseData = await response.json();

                    if (!responseData.data.contract || !responseData.data.contract.data) {
                        throw new Error('Contract data not found in the response');
                    }

                    // Create a Uint8Array from the data array in the response
                    const uint8Array = new Uint8Array(responseData.data.contract.data);

                    // Add the file to the zip
                    zip.file(`compiled_${responseData.data.filename}`, uint8Array, {binary: true});
                }

                // Generate the zip file
                const zipContent = await zip.generateAsync({type: 'blob'});

                // Download the zip file
                saveAs(zipContent, `contratti_compilati_${username}_${Date.now()}.zip`);

            } catch (error) {
                console.error('Error:', error)
                alert('An error occurred while uploading the files.')
            } finally {
                setLoading(false)
            }
        } else {
            setLoading(false)
            if (!visura) {
                alert('Please upload the Visura file before submitting.')
            } else if (!crediti) {
                alert('Please upload the Crediti file before submitting.')
            }
        }
    }

    return (
        <>
            <Topbar />
            <div className="container mx-auto p-4">
                <Card>
                    <CardHeader>
                        <h1 className="text-2xl font-bold">Compila contratti</h1>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">

                            <div>
                                <label htmlFor="visura" className="block text-sm font-medium text-gray-700 mb-1">
                                    Visura (PDF)
                                </label>
                                <Input
                                    id="visura"
                                    type="file"
                                    onChange={handleVisuraChange}
                                    accept=".pdf"
                                />
                            </div>

                            <div>
                                <label htmlFor="crediti" className="block text-sm font-medium text-gray-700 mb-1">
                                    Crediti (XLSX)
                                </label>
                                <Input
                                    id="crediti"
                                    type="file"
                                    onChange={handleCreditiChange}
                                    accept=".xlsx"
                                />
                            </div>

                            <div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">
                                        Seleziona Intervallo Anni
                                    </label>
                                    <div className="flex space-x-4">
                                        <div className="flex-1">
                                            <label htmlFor="start-year" className="text-sm text-gray-500">
                                                Anno Iniziale
                                            </label>
                                            <Select onValueChange={handleStartYearChange} value={startYear.toString()}>
                                                <SelectTrigger id="start-year">
                                                    <SelectValue placeholder="Seleziona anno iniziale"/>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {yearOptions.map((year) => (
                                                        <SelectItem key={year} value={year.toString()}>
                                                            {year}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex-1">
                                            <label htmlFor="end-year" className="text-sm text-gray-500">
                                                Anno Finale
                                            </label>
                                            <Select onValueChange={handleEndYearChange} value={endYear.toString()}>
                                                <SelectTrigger id="end-year">
                                                    <SelectValue placeholder="Seleziona anno finale"/>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {yearOptions.map((year) => (
                                                        <SelectItem key={year} value={year.toString()}>
                                                            {year}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="text-sm text-gray-500">
                                        Intervallo selezionato: da {startYear} a {endYear}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label htmlFor="percentuale cessione"
                                       className="block text-sm font-medium text-gray-700 mb-1">
                                    Percentuale Contratto di Cessione
                                </label>
                                <Input
                                    id="percentuale cessione"
                                    type="number"
                                    value={percentualeCessione}
                                    onChange={handlePercentualeCessioneChange}
                                    min="0"
                                    max="100"
                                    placeholder="Inserisci una percentuale (0-100)"
                                    step=".01"
                                />
                            </div>

                            <div>
                                <label htmlFor="percentuale"
                                       className="block text-sm font-medium text-gray-700 mb-1">
                                    Percentuale Società di Revisione
                                </label>
                                <Input
                                    id="percentuale revisione"
                                    type="number"
                                    value={percentualeRevisione}
                                    onChange={handlePercentualeRevisioneChange}
                                    min="0"
                                    max="100"
                                    placeholder="Inserisci una percentuale (0-100)"
                                    step=".01"
                                />
                            </div>

                            <div>
                                <label htmlFor="percentuale"
                                       className="block text-sm font-medium text-gray-700 mb-1">
                                    Percentuale Società di Consulenza
                                </label>
                                <Input
                                    id="percentuale"
                                    type="number"
                                    value={percentualeConsulenza}
                                    onChange={handlePercentualeConsulenzaChange}
                                    min="0"
                                    max="100"
                                    placeholder="Inserisci una percentuale (0-100)"
                                    step=".01"
                                />
                            </div>

                            <div>
                                <label htmlFor="percentuale"
                                       className="block text-sm font-medium text-gray-700 mb-1">
                                    IBAN Cedente
                                </label>
                                <Input
                                    id="iban"
                                    type="text"
                                    value={iban}
                                    onChange={handleIbanChange}
                                    placeholder="Inserisci un IBAN"
                                />
                            </div>

                            <div>
                                <h2 className="text-lg font-semibold mb-2">Sostituzioni personalizzate</h2>
                                {customReplacements.map((replacement, index) => (
                                    <div key={index} className="flex space-x-2 mb-2">
                                        <Input
                                            placeholder="Nome placeholder"
                                            value={replacement.placeholder}
                                            onChange={(e) => handleCustomReplacementChange(index, 'placeholder', e.target.value)}
                                        />
                                        <Input
                                            placeholder="Contenuto da sostituire"
                                            value={replacement.replacement}
                                            onChange={(e) => handleCustomReplacementChange(index, 'replacement', e.target.value)}
                                        />
                                    </div>
                                ))}
                                <Button type="button" onClick={addCustomReplacement} className="mt-2">
                                    <Plus className="mr-2 h-4 w-4"/> Aggiungi sostituzione
                                </Button>
                            </div>

                            {loading ?
                                <Button disabled>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin"/> Loading
                                </Button> :
                                <Button type="submit">Compila Contratto</Button>
                            }
                        </form>
                    </CardContent>
                </Card>
            </div>
        </>
)
}

export default withAuth(CompileContractsPage)