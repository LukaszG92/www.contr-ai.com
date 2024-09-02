import { useEffect, useState, FormEvent, ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Trash2, Plus } from 'lucide-react'
import Topbar from "@/components/Topbar"
import {withAuth} from "@/components/withAuth";

const MyContractsPage = () => {
    const [contracts, setContracts] = useState<string[]>([])
    const [newFile, setNewFile] = useState<File | null>(null)
    const [showForm, setShowForm] = useState<boolean>(false)

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
    }, [showForm])

    const trimFromFirstHyphen = (contractName: string): string => {
        const hyphenIndex = contractName.indexOf('-');
        const suffix = '.docx';

        if (hyphenIndex === -1) {
            return contractName.substring(0, contractName.length - suffix.length);
        }

        return contractName.substring(hyphenIndex + 1, contractName.length - suffix.length);
    };

    const removeContract = (contractName: string): void => {
        setContracts(contracts.filter(item => item !== contractName));
    };

    const handleDelete = async (filename: string): Promise<void> => {
        const username = localStorage.getItem('username');
        if (!username) {
            console.error('Username not found in localStorage');
            return;
        }

        try {
            const response = await fetch(`/api/contracts/delete/${filename}`, {
                method: 'DELETE',
                headers: {
                    'X-Username': username,
                },
            });

            if (response.ok) {
                const data = await response.json();
                removeContract(filename);
                alert(data.message);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete contract');
            }
        } catch (error) {
            console.error('Error deleting contract:', error);
            alert(error instanceof Error ? error.message : "Errore durante la rimozione del file.");
        }
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>): void => {
        const files = e.target.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (file.name.endsWith('.docx')) {
                setNewFile(file);
            } else {
                alert('Per favore, seleziona un file .docx');
                e.target.value = '';
            }
        } else {
            console.log('No file selected');
        }
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();
        if (newFile) {
            try {
                const formData = new FormData();
                formData.append('file', newFile);
                const username = localStorage.getItem('username');
                if (!username) {
                    throw new Error('Username not found in localStorage');
                }
                formData.append('username', username);

                const response = await fetch(`/api/contracts/upload`, {
                    method: 'POST',
                    body: formData,
                });

                if (response.ok) {
                    const result = await response.json();
                    setShowForm(false);
                    setNewFile(null);
                    alert(result.message || 'Contratto caricato con successo!');
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Errore durante il caricamento del file');
                }
            } catch (error) {
                console.error('Errore:', error);
                alert(error instanceof Error ? error.message : 'Si è verificato un errore durante il caricamento del file.');
            }
        } else {
            alert('Per favore, seleziona un file .docx prima di inviare.');
        }
    };

    return (
        <>
            <Topbar/>
            <div className="container mx-auto p-4">
                {!showForm && (
                    <Card className="mb-6">
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <h1 className="text-2xl font-bold">I miei contratti</h1>
                                <Button onClick={() => setShowForm(true)}>
                                    <Plus className="mr-2 h-4 w-4"/> Aggiungi contratto
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nome File</TableHead>
                                        <TableHead>Azioni</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {contracts.map((contract, index) => (
                                        <TableRow key={index}>
                                            <TableCell>{trimFromFirstHyphen(contract)}</TableCell>
                                            <TableCell>
                                                <Button variant="outline" size="icon"
                                                        onClick={() => handleDelete(contract)}>
                                                    <Trash2 className="h-4 w-4"/>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}

                {showForm && (
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <h1 className="text-2xl font-bold">Carica nuovo contratto</h1>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label htmlFor="fileUpload" className="block text-sm font-medium text-gray-700">
                                        Carica file .docx
                                    </label>
                                    <Input
                                        id="fileUpload"
                                        type="file"
                                        onChange={handleFileChange}
                                        accept=".docx"
                                        className="mt-1"
                                    />
                                </div>
                                <div className="flex justify-end space-x-2">
                                    <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                                        Annulla
                                    </Button>
                                    <Button type="submit">Carica Contratto</Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}
            </div>
        </>
    )
}

export default withAuth(MyContractsPage)