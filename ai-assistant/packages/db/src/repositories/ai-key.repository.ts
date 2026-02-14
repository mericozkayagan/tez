import { getPool } from '../client';
import { encrypt, decrypt, maskSecret } from '@ai-assistant/crypto';
import type { AIKey, AIProvider, AIKeyInfo, EncryptedValue } from '@ai-assistant/types';

export class AIKeyRepository {
    /**
     * Store (upsert) an encrypted AI API key for a user.
     */
    async upsert(userId: string, provider: AIProvider, apiKey: string): Promise<void> {
        const pool = getPool();
        const encrypted = encrypt(apiKey);

        await pool.query(
            `INSERT INTO ai_keys (user_id, provider, encrypted_key, iv, auth_tag)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id)
       DO UPDATE SET
         provider = EXCLUDED.provider,
         encrypted_key = EXCLUDED.encrypted_key,
         iv = EXCLUDED.iv,
         auth_tag = EXCLUDED.auth_tag,
         updated_at = NOW()`,
            [userId, provider, encrypted.encrypted, encrypted.iv, encrypted.authTag]
        );
    }

    /**
     * Retrieve and decrypt the AI API key for a user.
     */
    async getDecryptedKey(userId: string): Promise<{ provider: AIProvider; apiKey: string } | null> {
        const pool = getPool();
        const result = await pool.query<AIKey>(
            `SELECT provider, encrypted_key, iv, auth_tag
       FROM ai_keys WHERE user_id = $1`,
            [userId]
        );

        if (result.rows.length === 0) return null;

        const row = result.rows[0];
        const encryptedValue: EncryptedValue = {
            encrypted: row.encrypted_key,
            iv: row.iv,
            authTag: row.auth_tag,
        };

        return {
            provider: row.provider,
            apiKey: decrypt(encryptedValue),
        };
    }

    /**
     * Get masked key info for display (never returns raw key).
     */
    async getKeyInfo(userId: string): Promise<AIKeyInfo | null> {
        const pool = getPool();
        const result = await pool.query<AIKey>(
            `SELECT provider, encrypted_key, iv, auth_tag, created_at
       FROM ai_keys WHERE user_id = $1`,
            [userId]
        );

        if (result.rows.length === 0) return null;

        const row = result.rows[0];
        const encryptedValue: EncryptedValue = {
            encrypted: row.encrypted_key,
            iv: row.iv,
            authTag: row.auth_tag,
        };

        const decryptedKey = decrypt(encryptedValue);

        return {
            provider: row.provider,
            maskedKey: maskSecret(decryptedKey),
            createdAt: row.created_at,
        };
    }

    /**
     * Delete the stored AI key for a user.
     */
    async delete(userId: string): Promise<void> {
        const pool = getPool();
        await pool.query('DELETE FROM ai_keys WHERE user_id = $1', [userId]);
    }
}
