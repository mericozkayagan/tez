import { OAuthRepository } from '@ai-assistant/db';
import type { OAuthProvider } from '@ai-assistant/types';
import { TokenNotFoundError, TokenRefreshError } from './errors';

const oauthRepo = new OAuthRepository();

// Buffer: refresh 5 minutes before actual expiry
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

/**
 * Ensure the user has a valid (non-expired) access token for the given provider.
 * If expired, automatically refresh via the provider's token endpoint.
 * Returns the valid access token.
 *
 * Stateless – no Redis, no in-memory cache. Reads and writes directly to DB.
 */
export async function ensureValidToken(
    userId: string,
    provider: OAuthProvider,
    toolName: string
): Promise<string> {
    const tokens = await oauthRepo.getDecryptedTokens(userId, provider);

    if (!tokens) {
        throw new TokenNotFoundError(toolName, provider);
    }

    const now = Date.now();
    const expiresAt = tokens.tokenExpiry.getTime();

    // Token is still valid
    if (expiresAt - EXPIRY_BUFFER_MS > now) {
        return tokens.accessToken;
    }

    // Token expired → refresh
    if (provider === 'google') {
        return refreshGoogleToken(userId, tokens.refreshToken, toolName);
    } else if (provider === 'notion') {
        // Notion tokens don't expire (they're indefinite), but we handle it anyway
        return tokens.accessToken;
    }

    throw new TokenRefreshError(toolName, provider, 'Unknown provider');
}

/**
 * Refresh a Google OAuth access token using the refresh token.
 */
async function refreshGoogleToken(
    userId: string,
    refreshToken: string,
    toolName: string
): Promise<string> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new TokenRefreshError(toolName, 'google', 'Missing Google OAuth credentials in env');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new TokenRefreshError(toolName, 'google', `HTTP ${response.status}: ${errorBody}`);
    }

    const data = (await response.json()) as {
        access_token: string;
        expires_in: number;
    };

    const newExpiry = new Date(Date.now() + data.expires_in * 1000);

    // Persist the refreshed token (encrypted) in DB
    await oauthRepo.updateAccessToken(userId, 'google', data.access_token, newExpiry);

    return data.access_token;
}
