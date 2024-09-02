import { useRouter } from 'next/router'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import Topbar from "@/components/Topbar"
import { withAuth } from '@/components/withAuth'

const HomePage = () => {
    const router = useRouter()

    const handleNavigateToContracts = () => {
        router.push('/my-contracts')
    }

    const handleNavigateToNewContract = () => {
        router.push('/compile-contracts')
    }

    return (
        <>
            <Topbar/>
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <h1 className="text-2xl font-bold text-center">Homepage</h1>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button
                            onClick={handleNavigateToContracts}
                            className="w-full text-white"
                        >
                            I miei contratti
                        </Button>
                        <Button
                            onClick={handleNavigateToNewContract}
                            className="w-full text-white"
                        >
                            Compila nuovo contratto
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </>
    )
}

export default withAuth(HomePage)