import React, { useState, useEffect, createContext, useContext } from 'react'

interface AuthContextType {
    isLoggedIn: boolean;
    isLoading: boolean;
    login: (username: string) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isLoggedIn, setIsLoggedIn] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const storedUsername = localStorage.getItem('username')
        if (storedUsername) {
            setIsLoggedIn(true)
        }
        setIsLoading(false)
    }, [])

    const login = (username: string) => {
        localStorage.setItem('username', username)
        setIsLoggedIn(true)
    }

    const logout = () => {
        localStorage.removeItem('username')
        setIsLoggedIn(false)
    }

    const value: AuthContextType = {
        isLoggedIn,
        isLoading,
        login,
        logout
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}