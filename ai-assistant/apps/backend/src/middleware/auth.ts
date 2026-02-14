import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Authentication middleware – verifies JWT and attaches userId to request.
 * Apply to routes that require authentication.
 */
export async function authenticate(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    try {
        const decoded = await request.jwtVerify<{ sub: string; email: string }>();
        request.userId = decoded.sub;
    } catch (err) {
        // Fallback: Check if token is provided in query params (e.g. for OAuth redirects)
        const query = request.query as { token?: string };
        if (query && query.token) {
            try {
                const decoded = request.server.jwt.verify<{ sub: string; email: string }>(query.token);
                request.userId = decoded.sub;
                return;
            } catch (innerErr) {
                // Query token also invalid
            }
        }

        reply.status(401).send({
            error: 'Unauthorized',
            message: 'Invalid or expired authentication token',
        });
    }
}

/**
 * Extend FastifyRequest to include userId.
 */
declare module 'fastify' {
    interface FastifyRequest {
        userId: string;
    }
}
