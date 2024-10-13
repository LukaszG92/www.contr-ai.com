import {useState, ChangeEvent, FormEvent, useEffect} from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Loader2, Plus, Info, HelpCircle, X} from 'lucide-react'
import Topbar from "@/components/Topbar"
import { saveAs } from 'file-saver'
import {withAuth} from "@/components/withAuth";
import JSZip from 'jszip';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/components/ui/tooltip"

interface CustomReplacement {
    placeholder: string
    replacement: string
}

interface CreditiManuali {
    anno: string
    crediti: string
}

const CompileContractsPage = () => {
    const currentYear = new Date().getFullYear()

    const [loading, setLoading] = useState<boolean>(false)
    const [contracts, setContracts] = useState<string[]>([])
    const [visuras, setVisuras] = useState<(File | null)[]>([null])
    const [crediti, setCrediti] = useState<File | null>(null)
    const [creditiManuali, setCreditiManuali] = useState<CreditiManuali[]>([{ anno: '', crediti: '' }])
    const [percentualeCessione, setPercentualeCessione] = useState<string>('0')
    const [percentualeRevisione, setPercentualeRevisione] = useState<string>('0')
    const [percentualiConsulenza, setPercentualiConsulenza] = useState<number[]>([0]);
    const [iban, setIban] = useState<string>('')
    const [codiciTributo, setCodiciTributo] = useState<string>('')
    const [creditiManuale, setCreditiManuale] = useState<boolean>(true)
    const [customReplacements, setCustomReplacements] = useState<CustomReplacement[]>([{ placeholder: '', replacement: '' }])
    const [startYear, setStartYear] = useState<number>(currentYear)
    const [endYear, setEndYear] = useState<number>(currentYear)
    const [selectedItem, setSelectedItem] = useState('');
    const [addedItems, setAddedItems] = useState<string[]>([]);

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

    const handleVisuraChange = (e: ChangeEvent<HTMLInputElement>, index: number) => {
        const file = e.target.files?.[0];
        if (file && file.type === 'application/pdf') {
            const newVisuras = [...visuras];
            newVisuras[index] = file;
            setVisuras(newVisuras);
        } else {
            alert('Per favore, seleziona un file PDF per la Visura.');
            e.target.value = '';
        }
    };

    const addVisuraInput = () => {
        setVisuras([...visuras, null]);
    };

    const removeVisura = (index: number) => {
        if (visuras?.length > 1) {
            if (visuras) {
                const newVisuras = visuras.filter((_, i) => i !== index);
                setVisuras(newVisuras);
            }
        } else {
            setVisuras([null]);
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

    const handleTributiChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setCodiciTributo(value);
    };

    const addPercentualeConsulenza = () => {
        setPercentualiConsulenza([...percentualiConsulenza, 0]);
    };

    const handlePercentualeConsulenzaChange = (index: number, value: number) => {
        const updatedPercentuali = [...percentualiConsulenza];
        updatedPercentuali[index] = value;
        setPercentualiConsulenza(updatedPercentuali);
    };

    const removePercentualeConsulenza = (index: number) => {
        setPercentualiConsulenza(percentualiConsulenza.filter((_, i) => i !== index));
    };

    const handleCreditiManualiChange = (index: number, field: keyof CreditiManuali, value: string) => {
        const updatedCrediti = [...creditiManuali];
        updatedCrediti[index][field] = value;
        setCreditiManuali(updatedCrediti);
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

    const addCreditiManuali = () => {
        if (creditiManuali[creditiManuali.length - 1].anno &&
            creditiManuali[creditiManuali.length - 1].crediti) {
            setCreditiManuali([...creditiManuali, { anno: '', crediti: '' }]);
        } else {
            alert('Per favore, compila entrambi i campi dell\'ultima sostituzione prima di aggiungerne una nuova.');
        }
    };

    function numeroInLettere(n: number): string {
        const numeri: { [key: number]: string } = {
            0: "zero", 1: "uno", 2: "due", 3: "tre", 4: "quattro", 5: "cinque", 6: "sei", 7: "sette", 8: "otto", 9: "nove", 10: "dieci",
            11: "undici", 12: "dodici", 13: "tredici", 14: "quattordici", 15: "quindici", 16: "sedici", 17: "diciassette",
            18: "diciotto", 19: "diciannove", 20: "venti", 30: "trenta", 40: "quaranta", 50: "cinquanta", 60: "sessanta",
            70: "settanta", 80: "ottanta", 90: "novanta", 100: "cento"
        };

        // Convert integer part to words
        function convertIntegerPart(n: number): string {
            if (n in numeri) {
                return numeri[n];
            }

            let decina = Math.floor(n / 10) * 10;
            let unita = n % 10;

            if (unita === 1 || unita === 8) {
                return numeri[decina].slice(0, -1) + numeri[unita];
            } else {
                return numeri[decina] + numeri[unita];
            }
        }

        // Split the number into integer and decimal parts
        const [integerPart, decimalPart] = n.toString().split('.' ).map(Number);
        let result = convertIntegerPart(integerPart);

        // If there is a decimal part, convert it to words as well
        if (decimalPart !== undefined) {
            result += ` virgola ${convertIntegerPart(decimalPart)}`;
        }

        return result;
    }

    interface LabelWithTooltipProps {
        htmlFor: string;
        label: string;
        tooltipContent: string;
    }

    const LabelWithTooltip: React.FC<LabelWithTooltipProps> = ({ htmlFor, label, tooltipContent }) => (
        <div className="flex items-center space-x-1 mb-1">
            <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700">
                {label}
            </label>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            className="focus:outline-none"
                            onClick={(e) => e.preventDefault()}
                        >
                            <HelpCircle className="h-3 w-3 text-gray-400" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" className="max-w-xs">
                        <p className="text-xs text-gray-500">{tooltipContent}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    )

    function removeNullElements<T>(arr: (T | null)[]): T[] {
        return arr.filter((element): element is T => element !== null);
    }

    const trimFromFirstHyphen = (contractName: string): string => {
        const hyphenIndex = contractName.indexOf('-');
        const suffix = '.docx';

        if (hyphenIndex === -1) {
            return contractName.substring(0, contractName.length - suffix.length);
        }

        return contractName.substring(hyphenIndex + 1, contractName.length - suffix.length);
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        try {
            let formData = new FormData()
            let visuraReplacements: Record<string, string> = {}
            let fileCounter = 1
            console.log(visuras)
            for (const visura of removeNullElements(visuras)) {
                console.log(visura)
                if (visura) {
                    formData.append('visura', visura)

                    let response = await fetch('/api/contracts/compile/visura-extractor', {
                        method: 'POST',
                        body: formData
                    } as RequestInit)

                    let responseJson = await response.json()

                    for (let key in responseJson.replacements) {
                        visuraReplacements[key + fileCounter] = responseJson.replacements[key]
                    }

                    fileCounter++
                }
            }

            let creditiReplacements = {}
            if(crediti) {
                formData = new FormData()
                formData.append('crediti', crediti)
                formData.append('percentuale_cessione', `${percentualeCessione}`)
                formData.append('percentuale_revisione', `${percentualeRevisione}`)
                formData.append('percentuali_consulenza', `${percentualiConsulenza}`)
                formData.append('anno_iniziale', String(startYear))
                formData.append('anno_finale', String(endYear))

                let response = await fetch('/api/contracts/compile/crediti-extractor', {
                    method: 'POST',
                    body: formData
                } as RequestInit)

                let responseJson = await response.json()
                creditiReplacements = responseJson.replacements
            } else {
                formData = new FormData()
                let crediti: Record<string, number> = {}
                creditiManuali.forEach(elem => {
                    crediti[elem.anno] = Number(elem.crediti)
                })

                formData.append('crediti', JSON.stringify(crediti))
                formData.append('percentuale_cessione', `${percentualeCessione}`)
                formData.append('percentuale_revisione', `${percentualeRevisione}`)
                formData.append('percentuali_consulenza', `${percentualiConsulenza}`)

                let response = await fetch('/api/contracts/compile/crediti-calculator', {
                    method: 'POST',
                    body: formData
                } as RequestInit)

                let responseJson = await response.json()
                creditiReplacements = responseJson.replacements
            }

            let replacements: Record<string, string> = {
                ...creditiReplacements,
                ...visuraReplacements,
                'percentuale cessione': `${percentualeCessione}% (${numeroInLettere(Number(percentualeCessione))}) `,
                'percentuale revisione': `${percentualeRevisione}% (${numeroInLettere(Number(percentualeRevisione))}) `,
                //'percentuale consulenza': `${percentualeConsulenza}% (${numeroInLettere(Number(percentualeConsulenza))}) `,
                'iban': iban,
                'codici tributo': codiciTributo
            }

            if(percentualiConsulenza.length == 1) {
                replacements['percentuale consulenza'] = `${percentualiConsulenza[0]}% (${numeroInLettere(Number(percentualiConsulenza[0]))})`
            } else {
                let counter = 1
                percentualiConsulenza.forEach(value => {
                    replacements['percentuale consulenza' + counter] = `${value}% (${numeroInLettere(Number(value))})`
                    counter++
                })
            }

            customReplacements.forEach(elem => {
                replacements[elem.placeholder] = elem.replacement
            })

            console.log(replacements)

            const username = localStorage.getItem('username')
            if (!username) {
                console.error('Username not found in localStorage')
                return
            }

            // Create a new JSZip instance
            const zip = new JSZip();

            // Compile each contract and add to zip
            for (const contract of addedItems) {
                formData = new FormData();
                formData.append('contract', contract);
                formData.append('replacements', JSON.stringify(replacements));
                formData.append('username', username);

                let response = await fetch('/api/contracts/compile/compile', {
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
        /*} else {
            setLoading(false)
            if (!visura) {
                alert('Please upload the Visura file before submitting.')
            } else if (!crediti) {
                alert('Please upload the Crediti file before submitting.')
            }
        }*/
    }

    const handleItemClick = (item: string) => {
        if (addedItems.includes(item)) {
            setAddedItems(addedItems.filter(addedItem => addedItem !== item));
        } else {
            setAddedItems([...addedItems, item]);
        }
    };

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
                                <h3 className="text-lg font-semibold">Contratti Disponibili</h3>
                                <ul className="space-y-2">
                                    {contracts.filter((item) => !addedItems.includes(item)).map((item, index) => (
                                        <li
                                            key={index}
                                            onClick={() => handleItemClick(item)}
                                            className="cursor-pointer p-2 border rounded bg-white"
                                        >
                                            {trimFromFirstHyphen(item)}
                                        </li>
                                    ))}
                                </ul>
                                <h3 className="text-lg font-semibold mt-4">Contratti da Compilare</h3>
                                <ul className="space-y-2">
                                    {addedItems.map((item, index) => (
                                        <li
                                            key={index}
                                            onClick={() => handleItemClick(item)}
                                            className="p-2 border rounded bg-green-100"
                                        >
                                            {trimFromFirstHyphen(item)}
                                        </li>
                                    ))}
                                </ul>
                            </div>


                            <div>
                                <LabelWithTooltip
                                    htmlFor="visura"
                                    label="Visure Camerale"
                                    tooltipContent="Estrae le informazioni relative dalla Visura Camerale come Nome società, Sede Legale, Rappresentante Legale, Pec e Partita IVA."
                                />
                                {visuras.map((visura, index) => (
                                    <div key={index} className="flex items-center space-x-2 mb-2">
                                        <Input
                                            id={`visura-${index}`}
                                            type="file"
                                            onChange={(e) => handleVisuraChange(e, index)}
                                            accept=".pdf"
                                            className="flex-grow"
                                        />
                                        <Button
                                            type="button"
                                            onClick={() => removeVisura(index)}
                                            variant="outline"
                                            size="icon"
                                            className="flex-shrink-0"
                                        >
                                            <X className="h-4 w-4"/>
                                        </Button>
                                    </div>
                                ))}
                                <Button type="button" onClick={addVisuraInput} className="mt-2">
                                    <Plus className="mr-2 h-4 w-4"/> Aggiungi altra Visura
                                </Button>
                            </div>


                            {/*{!creditiManuale && (
                                    <div>
                                        <LabelWithTooltip
                                            htmlFor="crediti"
                                            label="Crediti del cedente"
                                            tooltipContent="Estrae dal cassetto fiscale i crediti totali per ogni annualità, per poi calcolare Crediti scontati, Commissioni della Società di Revisione, Commissioni della Società di Consulenza, e il Netto cliente. Questi valori vengono calcolati sia anno per anno, per tutti gli anni nell'intervallo selezionato, sia sul totale di tutte le annualità selezionate"
                                        />
                                        <div className="flex items-center space-x-2">
                                            <Input
                                                id="crediti"
                                                type="file"
                                                onChange={handleCreditiChange}
                                                accept=".xlsx"
                                                className="flex-grow"
                                            />
                                            <Button onClick={() => setCreditiManuale(true)}>Inserisci
                                                manualmente</Button>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-700">
                                                Seleziona Intervallo Anni
                                            </label>
                                            <div className="flex space-x-4">
                                                <div className="flex-1">
                                                    <label htmlFor="start-year" className="text-sm text-gray-500">
                                                        Anno Iniziale
                                                    </label>
                                                    <Select onValueChange={handleStartYearChange}
                                                            value={startYear.toString()}>
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
                                                    <Select onValueChange={handleEndYearChange}
                                                            value={endYear.toString()}>
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
                                )}
                                */}

                            {creditiManuale && (
                                <div>
                                    <div className="flex items-center justify-between w-full">
                                        <LabelWithTooltip
                                            htmlFor="crediti"
                                            label="Crediti del cedente"
                                            tooltipContent="Estrae dal cassetto fiscale i crediti totali per ogni annualità, per poi calcolare Crediti scontati, Commissioni della Società di Revisione, Commissioni della Società di Consulenza, e il Netto cliente. Questi valori vengono calcolati sia anno per anno, per tutti gli anni nell'intervallo selezionato, sia sul totale di tutte le annualità selezionate"
                                        />
                                        {/*<Button onClick={() => setCreditiManuale(false)}>Inserisci file</Button>*/}
                                    </div>
                                    <div className="mt-3">
                                        {creditiManuali.map((replacement, index) => (
                                            <div key={index} className="flex space-x-2 mb-2">
                                                <Input
                                                    placeholder="Anno"
                                                    value={replacement.anno}
                                                    type="number"
                                                    step=".01"
                                                    onChange={(e) => handleCreditiManualiChange(index, 'anno', e.target.value)}
                                                />
                                                <Input
                                                    placeholder="Crediti"
                                                    value={replacement.crediti}
                                                    type="number"
                                                    step=".01"
                                                    onChange={(e) => handleCreditiManualiChange(index, 'crediti', e.target.value)}
                                                />
                                            </div>
                                        ))}
                                        <Button type="button" onClick={addCreditiManuali} className="mt-2">
                                            <Plus className="mr-2 h-4 w-4"/> Aggiungi anno
                                        </Button>
                                    </div>
                                </div>
                            )}

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

                            {/*
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
                            */}

                            <div>
                                <h3 className="text-lg font-semibold mt-4">Percentuali Consulenza</h3>
                                {percentualiConsulenza.map((percentuale, index) => (
                                    <div key={index} className="flex items-center space-x-2 mb-2">
                                        <Input
                                            type="number"
                                            value={percentuale}
                                            onChange={(e) =>
                                                handlePercentualeConsulenzaChange(index, parseFloat(e.target.value))
                                            }
                                            placeholder="Inserisci percentuale"
                                            min="0"
                                            max="100"
                                            step=".01"
                                            className="flex-grow"
                                        />
                                        <Button
                                            type="button"
                                            onClick={() => removePercentualeConsulenza(index)}
                                        >
                                            Rimuovi
                                        </Button>
                                    </div>
                                ))}
                                <Button type="button" onClick={addPercentualeConsulenza} className="mt-2">
                                    Aggiungi Percentuale Consulenza
                                </Button>
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
                                <label htmlFor="percentuale"
                                       className="block text-sm font-medium text-gray-700 mb-1">
                                    Codici Tributo
                                </label>
                                <Input
                                    id="iban"
                                    type="text"
                                    value={iban}
                                    onChange={handleIbanChange}
                                    placeholder="Inserisci i codici tributo"
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