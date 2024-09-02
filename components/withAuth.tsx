import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthProvider';

export function withAuth<P>(WrappedComponent: React.ComponentType<P>) {
    return function WithAuth(props: P) {
        const router = useRouter();
        const { isLoggedIn, isLoading } = useAuth();

        useEffect(() => {
            if (!isLoading && !isLoggedIn) {
                router.push('/login');
            }
        }, [isLoggedIn, isLoading, router]);

        if (isLoading) {
            return <div>Loading...</div>; // Or a proper loading spinner
        }

        if (!isLoggedIn) {
            return null;
        }

        return <WrappedComponent {...props} />;
    };
}