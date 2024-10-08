import { useContext, useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../context/AuthProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card'

const LoginPage = () => {
    const { isLoggedIn, isLoading, login: authLogin } = useAuth()
    const router = useRouter()
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')

    useEffect(() => {
        if (!isLoading && isLoggedIn) {
            router.push('/')
        }
    }, [isLoading, isLoggedIn, router])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const response = await fetch('/api/users/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            })

            if (!response.ok) {
                throw new Error('Login failed')
            }

            const data = await response.json()
            authLogin(data.data.username)
            router.push('/')
        } catch (error) {
            alert(error instanceof Error ? error.message : 'An error occurred during login')
        }
    }

    if (isLoading) {
        return <div>Loading...</div> // Or a proper loading spinner
    }

    if (isLoggedIn) {
        return null
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <h1 className="text-2xl font-bold text-center">Login</h1>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                                Username
                            </label>
                            <Input
                                id="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                Password
                            </label>
                            <Input
                                id="password"
                                type="text"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="mt-1"
                            />
                        </div>
                        <Button type="submit" className="w-full">
                            Log In
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}

export default LoginPage