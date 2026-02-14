import { getPool } from '../client';
import { encrypt, decrypt } from '@ai-assistant/crypto';
import type { OAuthAccount, OAuthProvider, OAuthConnection, EncryptedValue } from '@ai-assistant/types';

export class OAuthRepository {
    /**
     * Store (upsert) encrypted OAuth tokens for a user + provider.
     */
    async upsertTokens(
        userId: string,
        provider: OAuthProvider,
        accessToken: string,
        refreshToken: string,
        expiresAt: Date,
        scope: string
    ): Promise<void> {
        const pool = getPool();
        const encAccess = encrypt(accessToken);
        const encRefresh = encrypt(refreshToken);

        await pool.query(
            `INSERT INTO oauth_accounts (
        user_id, provider,
        encrypted_access_token, access_token_iv, access_token_tag,
        encrypted_refresh_token, refresh_token_iv, refresh_token_tag,
        token_expiry, scope
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (user_id, provider)
      DO UPDATE SET
        encrypted_access_token = EXCLUDED.encrypted_access_token,
        access_token_iv        = EXCLUDED.access_token_iv,
        access_token_tag       = EXCLUDED.access_token_tag,
        encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
        refresh_token_iv       = EXCLUDED.refresh_token_iv,
        refresh_token_tag      = EXCLUDED.refresh_token_tag,
        token_expiry           = EXCLUDED.token_expiry,
        scope                  = EXCLUDED.scope,
        updated_at             = NOW()`,
            [
                userId,
                provider,
                encAccess.encrypted, encAccess.iv, encAccess.authTag,
                encRefresh.encrypted, encRefresh.iv, encRefresh.authTag,
                expiresAt,
                scope,
            ]
        );
    }

    /**
     * Get the decrypted access token for a user + provider.
     */
    async getDecryptedTokens(
        userId: string,
        provider: OAuthProvider
    ): Promise<{
        accessToken: string;
        refreshToken: string;
        tokenExpiry: Date;
    } | null> {
        const pool = getPool();
        const result = await pool.query<OAuthAccount>(
            `SELECT encrypted_access_token, access_token_iv, access_token_tag,
              encrypted_refresh_token, refresh_token_iv, refresh_token_tag,
              token_expiry
       FROM oauth_accounts
       WHERE user_id = $1 AND provider = $2`,
            [userId, provider]
        );

        if (result.rows.length === 0) return null;

        const row = result.rows[0];

        const accessTokenEnc: EncryptedValue = {
            encrypted: row.encrypted_access_token,
            iv: row.access_token_iv,
            authTag: row.access_token_tag,
        };

        const refreshTokenEnc: EncryptedValue = {
            encrypted: row.encrypted_refresh_token,
            iv: row.refresh_token_iv,
            authTag: row.refresh_token_tag,
        };

        return {
            accessToken: decrypt(accessTokenEnc),
            refreshToken: decrypt(refreshTokenEnc),
            tokenExpiry: new Date(row.token_expiry),
        };
    }

    /**
     * Update just the access token after a refresh.
     */
    async updateAccessToken(
        userId: string,
        provider: OAuthProvider,
        newAccessToken: string,
        newExpiry: Date
    ): Promise<void> {
        const pool = getPool();
        const enc = encrypt(newAccessToken);

        await pool.query(
            `UPDATE oauth_accounts
       SET encrypted_access_token = $1,
           access_token_iv = $2,
           access_token_tag = $3,
           token_expiry = $4,
           updated_at = NOW()
       WHERE user_id = $5 AND provider = $6`,
            [enc.encrypted, enc.iv, enc.authTag, newExpiry, userId, provider]
        );
    }

    /**
     * Get all connection statuses for a user.
     */
    async getConnections(userId: string): Promise<OAuthConnection[]> {
        const pool = getPool();
        const result = await pool.query<OAuthAccount>(
            `SELECT provider, scope, created_at FROM oauth_accounts WHERE user_id = $1`,
            [userId]
        );

        const connectedProviders = new Map(
            result.rows.map((row) => [
                row.provider,
                { scope: row.scope, connectedAt: row.created_at },
            ])
        );

        const allProviders: OAuthProvider[] = ['google', 'notion'];
        return allProviders.map((provider) => {
            const info = connectedProviders.get(provider);
            return {
                provider,
                connected: !!info,
                scope: info?.scope,
                connectedAt: info?.connectedAt,
            };
        });
    }

    /**
     * Disconnect an OAuth provider for a user.
     */
    async disconnect(userId: string, provider: OAuthProvider): Promise<void> {
        const pool = getPool();
        await pool.query(
            'DELETE FROM oauth_accounts WHERE user_id = $1 AND provider = $2',
            [userId, provider]
        );
    }
}
