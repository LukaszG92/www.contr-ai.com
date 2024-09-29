import {useState, ChangeEvent, FormEvent, useEffect} from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Plus } from 'lucide-react'
import Topbar from "@/components/Topbar"
import { saveAs } from 'file-saver'
import {withAuth} from "@/components/withAuth";

interface CustomReplacement {
    placeholder: string
    replacement: string
}

const CompileContractsPage = () => {
    const [contracts, setContracts] = useState<string[]>([])
    const [visura, setVisura] = useState<File | null>(null)
    const [crediti, setCrediti] = useState<File | null>(null)
    const [percentuale, setPercentuale] = useState<string>('0')
    const [customReplacements, setCustomReplacements] = useState<CustomReplacement[]>([{ placeholder: '', replacement: '' }])

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
                    console.log(responseData.data.contratti)
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

    const handlePercentualeChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value === '' || (Number(value) >= 0 && Number(value) <= 100)) {
            setPercentuale(value);
        }
    };

    const handleCustomReplacementChange = (index: number, field: keyof CustomReplacement, value: string) => {
        const updatedReplacements = [...customReplacements];
        updatedReplacements[index][field] = value;
        setCustomReplacements(updatedReplacements);
    };

    const addCustomReplacement = () => {
        if (customReplacements[customReplacements.length - 1].placeholder &&
            customReplacements[customReplacements.length - 1].replacement) {
            setCustomReplacements([...customReplacements, { placeholder: '', replacement: '' }]);
        } else {
            alert('Per favore, compila entrambi i campi dell\'ultima sostituzione prima di aggiungerne una nuova.');
        }
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
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

                response = await fetch('/api/contracts/compile/crediti-extractor', {
                    method: 'POST',
                    body: formData
                }as RequestInit)

                responseJson = await response.json()
                let creditiReplacements = responseJson.replacements

                let replacements = {
                    ...creditiReplacements,
                    ...visuraReplacements
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

                for (const contract of contracts) {
                    formData = new FormData();
                    formData.append('contract', contract);
                    formData.append('replacements', JSON.stringify(replacements));
                    formData.append('username', username);

                    response = await fetch('/api/contracts/compile/compile', {
                        method: 'POST',
                        body: formData
                    } as RequestInit);

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    // Parse the JSON response
                    const responseData = await response.json();

                    if (!responseData.contract || !responseData.contract.data) {
                        throw new Error('Contract data not found in the response');
                    }

                    // Create a Uint8Array from the data array in the response
                    const uint8Array = new Uint8Array(responseData.contract.data);

                    // Create a Blob from the Uint8Array
                    const blob = new Blob([uint8Array], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

                    // Create a download link and trigger the download
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = `contrattoCompilato_${Date.now()}.docx`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                }

                /*
                const formData = new FormData()
                formData.append('visura', visura)
                formData.append('crediti', crediti)
                formData.append('percentuale', percentuale)
                const username = localStorage.getItem('username')
                if (username) {
                    formData.append('username', username)
                }





                response = await fetch('/api/contracts/compile', {
                    method: 'POST',
                    body: formData,
                }as RequestInit)

                const blob = await response.blob()
                saveAs(blob, `${username || 'user'}_contracts_${Date.now()}.zip`)
                 */
            } catch (error) {
                console.error('Error:', error)
                alert('An error occurred while uploading the files.')
            }
        } else {
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
                                <label htmlFor="percentuale" className="block text-sm font-medium text-gray-700 mb-1">
                                    Percentuale
                                </label>
                                <Input
                                    id="percentuale"
                                    type="number"
                                    value={percentuale}
                                    onChange={handlePercentualeChange}
                                    min="0"
                                    max="100"
                                    placeholder="Inserisci una percentuale (0-100)"
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
                                    <Plus className="mr-2 h-4 w-4" /> Aggiungi sostituzione
                                </Button>
                            </div>

                            <Button type="submit">Compila Contratto</Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </>
    )
}

export default withAuth(CompileContractsPage)