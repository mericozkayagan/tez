import type { FastifyInstance } from 'fastify';
import { AIKeySchema } from '@ai-assistant/types';
import { AIKeyRepository, OAuthRepository } from '@ai-assistant/db';
import { authenticate } from '../middleware/auth.js';

const aiKeyRepo = new AIKeyRepository();
const oauthRepo = new OAuthRepository();

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
    // All settings routes require authentication
    app.addHook('onRequest', authenticate);

    /**
     * POST /settings/ai-key
     * Store or update the user's AI API key (encrypted).
     */
    app.post('/ai-key', async (request, reply) => {
        const parsed = AIKeySchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Validation Error',
                details: parsed.error.flatten().fieldErrors,
            });
        }

        const { provider, apiKey } = parsed.data;
        await aiKeyRepo.upsert(request.userId, provider, apiKey);

        return reply.status(200).send({
            message: 'AI API key saved successfully',
            provider,
        });
    });

    /**
     * GET /settings/ai-key
     * Get stored AI key info (provider + masked key, never raw key).
     */
    app.get('/ai-key', async (request, reply) => {
        const keyInfo = await aiKeyRepo.getKeyInfo(request.userId);
        if (!keyInfo) {
            return reply.status(404).send({
                error: 'Not Found',
                message: 'No AI API key configured',
            });
        }
        return reply.send(keyInfo);
    });

    /**
     * DELETE /settings/ai-key
     * Remove the stored AI API key.
     */
    app.delete('/ai-key', async (request, reply) => {
        await aiKeyRepo.delete(request.userId);
        return reply.send({ message: 'AI API key removed' });
    });

    /**
     * GET /settings/connections
     * List all OAuth connection statuses.
     */
    app.get('/connections', async (request, reply) => {
        const connections = await oauthRepo.getConnections(request.userId);
        return reply.send({ connections });
    });
}
