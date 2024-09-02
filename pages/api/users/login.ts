import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';

interface User {
    username: string;
    password: string;
}

interface ApiResponse {
    status: 'success' | 'failure';
    message: string;
    data?: {
        username: string;
    };
}

type ValidationRule = (value: string) => string | null;

interface ValidationRules {
    [key: string]: ValidationRule;
}

const validateLogin: ValidationRules = {
    username: (value) => value ? null : 'Il campo username non può essere vuoto.',
    password: (value) => value ? null : 'Il campo password non può essere vuoto.',
};

function validate(data: any, rules: ValidationRules): string | null {
    for (const [field, rule] of Object.entries(rules)) {
        const error = rule(data[field]);
        if (error) return error;
    }
    return null;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ApiResponse>
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ status: "failure", message: "Metodo non consentito" });
    }

    const validationError = validate(req.body, validateLogin);
    if (validationError) {
        return res.status(422).json({
            status: "failure",
            message: validationError
        });
    }

    const { username, password } = req.body as User;

    try {
        const filePath = path.join(process.cwd(), 'db', 'users.json');
        const fileContents = await fs.readFile(filePath, 'utf8');
        const file: { users: [string, string][] } = JSON.parse(fileContents);
        const users = file.users;

        for (let i = 0; i < users.length; i++) {
            if (username === users[i][0]) {
                if (password === users[i][1]) {
                    return res.status(200).json({
                        status: "success",
                        message: "Login effettuato con successo!",
                        data: {
                            username: username
                        }
                    });
                }
                return res.status(403).json({
                    status: "failure",
                    message: "Password errata. Riprova."
                });
            }
        }

        return res.status(403).json({
            status: "failure",
            message: "Nome utente inesistente. Riprova.",
        });
    } catch (error) {
        console.error('Errore durante il login:', error);
        return res.status(500).json({ status: "failure", message: "Errore interno del server" });
    }
}