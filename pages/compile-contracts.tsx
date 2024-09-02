import { useState, ChangeEvent, FormEvent } from 'react'
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
    const [visura, setVisura] = useState<File | null>(null)
    const [crediti, setCrediti] = useState<File | null>(null)
    const [percentuale, setPercentuale] = useState<string>('0')
    const [customReplacements, setCustomReplacements] = useState<CustomReplacement[]>([{ placeholder: '', replacement: '' }])

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
                const formData = new FormData()
                formData.append('visura', visura)
                formData.append('crediti', crediti)
                formData.append('percentuale', percentuale)
                const username = localStorage.getItem('username')
                if (username) {
                    formData.append('username', username)
                }

                customReplacements.forEach((replacement, index) => {
                    if (replacement.placeholder && replacement.replacement) {
                        formData.append(`customReplacement[${index}][placeholder]`, replacement.placeholder)
                        formData.append(`customReplacement[${index}][replacement]`, replacement.replacement)
                    }
                })

                const response = await fetch('/api/contracts/compile', {
                    method: 'POST',
                    body: formData,
                }as RequestInit)

                const blob = await response.blob()
                saveAs(blob, `${username || 'user'}_contracts_${Date.now()}.zip`)
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