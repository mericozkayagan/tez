import type { FastifyInstance } from 'fastify';
import { OAuthRepository } from '@ai-assistant/db';
import type { OAuthProvider } from '@ai-assistant/types';
import { authenticate } from '../middleware/auth.js';

const oauthRepo = new OAuthRepository();

// Google OAuth scopes
const GOOGLE_SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
].join(' ');

export async function oauthRoutes(app: FastifyInstance): Promise<void> {
    // Remove global auth hook
    // app.addHook('onRequest', authenticate);

    /**
     * POST /oauth/:provider/initiate
     * Returns the OAuth redirect URL — frontend POSTs with Bearer token (no JWT in URL).
     */
    app.post<{ Params: { provider: string } }>(
        '/:provider/initiate',
        { onRequest: authenticate },
        async (request, reply) => {
            const { provider } = request.params;
            const state = app.jwt.sign({ sub: request.userId }, { expiresIn: '5m' });

            if (provider === 'google') {
                const params = new URLSearchParams({
                    client_id: process.env.GOOGLE_CLIENT_ID!,
                    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
                    response_type: 'code',
                    scope: GOOGLE_SCOPES,
                    access_type: 'offline',
                    prompt: 'consent',
                    state,
                });
                return reply.send({ redirectUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
            }

            if (provider === 'notion') {
                const params = new URLSearchParams({
                    client_id: process.env.NOTION_CLIENT_ID!,
                    redirect_uri: process.env.NOTION_REDIRECT_URI!,
                    response_type: 'code',
                    owner: 'user',
                    state,
                });
                return reply.send({ redirectUrl: `https://api.notion.com/v1/oauth/authorize?${params}` });
            }

            return reply.status(400).send({ error: `Unknown OAuth provider: ${provider}` });
        }
    );

    /**
     * GET /oauth/:provider/authorize (legacy — kept for backwards compatibility)
     * Redirect user to OAuth consent screen via GET + query token.
     */
    app.get<{ Params: { provider: string } }>(
        '/:provider/authorize',
        { onRequest: authenticate },
        async (request, reply) => {
            const { provider } = request.params;
            const state = app.jwt.sign({ sub: request.userId }, { expiresIn: '5m' });

            if (provider === 'google') {
                const params = new URLSearchParams({
                    client_id: process.env.GOOGLE_CLIENT_ID!,
                    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
                    response_type: 'code',
                    scope: GOOGLE_SCOPES,
                    access_type: 'offline',
                    prompt: 'consent',
                    state,
                });
                return reply.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
            }

            if (provider === 'notion') {
                const params = new URLSearchParams({
                    client_id: process.env.NOTION_CLIENT_ID!,
                    redirect_uri: process.env.NOTION_REDIRECT_URI!,
                    response_type: 'code',
                    owner: 'user',
                    state,
                });
                return reply.redirect(`https://api.notion.com/v1/oauth/authorize?${params}`);
            }

            return reply.status(400).send({
                error: 'Bad Request',
                message: `Unknown OAuth provider: ${provider}`,
            });
        }
    );

    /**
     * GET /oauth/:provider/callback
     * Exchange authorization code for tokens, encrypt, and store.
     * No 'authenticate' hook because this comes from 3rd party without our Auth header.
     * We validate 'state' instead.
     */
    app.get<{ Params: { provider: string }; Querystring: { code: string; state?: string } }>(
        '/:provider/callback',
        async (request, reply) => {
            const { provider } = request.params;
            const { code, state } = request.query;

            if (!code) {
                return reply.status(400).send({ error: 'Missing authorization code' });
            }

            if (!state) {
                return reply.status(400).send({ error: 'Missing state parameter' });
            }

            let userId: string;
            try {
                const decoded = app.jwt.verify<{ sub: string }>(state);
                userId = decoded.sub;
            } catch (err) {
                return reply.status(401).send({ error: 'Invalid or expired state parameter. Please try again.' });
            }

            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

            try {
                if (provider === 'google') {
                    await handleGoogleCallback(userId, code);
                } else if (provider === 'notion') {
                    await handleNotionCallback(userId, code);
                } else {
                    return reply.status(400).send({ error: `Unknown provider: ${provider}` });
                }

                // Redirect back to frontend settings
                return reply.redirect(`${frontendUrl}/settings?connected=${provider}`);
            } catch (err) {
                const message = err instanceof Error ? err.message : 'OAuth callback failed';
                app.log.error({ err, provider }, 'OAuth callback error');
                return reply.redirect(`${frontendUrl}/settings?error=${encodeURIComponent(message)}`);
            }
        }
    );

    /**
     * DELETE /oauth/:provider
     * Disconnect an OAuth provider.
     */
    app.delete<{ Params: { provider: string } }>(
        '/:provider',
        { onRequest: authenticate }, // Auth required
        async (request, reply) => {
            const provider = request.params.provider as OAuthProvider;
            if (!['google', 'notion'].includes(provider)) {
                return reply.status(400).send({ error: `Unknown provider: ${provider}` });
            }

            await oauthRepo.disconnect(request.userId, provider);
            return reply.send({ message: `${provider} disconnected successfully` });
        }
    );
}

// ── Helper: exchange Google auth code ──

async function handleGoogleCallback(userId: string, code: string): Promise<void> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            code,
            grant_type: 'authorization_code',
            redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Google token exchange failed: ${err}`);
    }

    const data = (await response.json()) as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        scope: string;
    };

    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    await oauthRepo.upsertTokens(
        userId,
        'google',
        data.access_token,
        data.refresh_token,
        expiresAt,
        data.scope
    );
}

// ── Helper: exchange Notion auth code ──

async function handleNotionCallback(userId: string, code: string): Promise<void> {
    const credentials = Buffer.from(
        `${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`
    ).toString('base64');

    const response = await fetch('https://api.notion.com/v1/oauth/token', {
        method: 'POST',
        headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            grant_type: 'authorization_code',
            code,
            redirect_uri: process.env.NOTION_REDIRECT_URI,
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Notion token exchange failed: ${err}`);
    }

    const data = (await response.json()) as {
        access_token: string;
        workspace_name: string;
    };

    // Notion tokens don't expire, set far future expiry
    const farFuture = new Date('2099-12-31T23:59:59Z');

    await oauthRepo.upsertTokens(
        userId,
        'notion',
        data.access_token,
        'notion-no-refresh-token', // Notion doesn't use refresh tokens
        farFuture,
        'full-access'
    );
}
