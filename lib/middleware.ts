// lib/middleware.ts

import { NextApiRequest, NextApiResponse } from 'next';

type MiddlewareFunction = (
    req: NextApiRequest,
    res: NextApiResponse,
    next: (result: Error | any) => void
) => void;

export default function runMiddleware(
    req: NextApiRequest,
    res: NextApiResponse,
    fn: MiddlewareFunction
): Promise<void> {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) {
                return reject(result);
            }
            return resolve(result);
        });
    });
}