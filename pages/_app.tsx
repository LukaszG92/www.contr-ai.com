import { AuthProvider } from '@/context/AuthProvider'
import type { AppProps } from 'next/app'
import '@/styles/global.css'

function MyApp({ Component, pageProps }: AppProps) {
    return (
        <AuthProvider>
            <Component {...pageProps} />
        </AuthProvider>
    )
}

export default MyApp