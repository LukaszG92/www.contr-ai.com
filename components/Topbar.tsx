import { useAuth } from '@/context/AuthProvider';
import { Button } from '@/components/ui/button';
import { Home, LogOut } from 'lucide-react';
import { useRouter } from 'next/router';
import Link from 'next/link';

const Topbar = () => {
    const router = useRouter();
    const { isLoggedIn, logout } = useAuth();

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    const showHomeButton = router.pathname.includes('/my-contracts') || router.pathname.includes('/compile-contracts');

    return (
        <div className="bg-primary text-primary-foreground shadow-md">
            <div className="container mx-auto px-4 py-2 flex justify-between items-center">
                <div className="text-xl font-bold">ContrAI</div>
                <div className="space-x-2">
                    {showHomeButton && (
                        <Link href="/home" passHref>
                            <Button variant="ghost">
                                <Home className="mr-2 h-4 w-4" />
                                Home
                            </Button>
                        </Link>
                    )}
                    {isLoggedIn && (
                        <Button variant="ghost" onClick={handleLogout}>
                            <LogOut className="mr-2 h-4 w-4" />
                            Logout
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Topbar;