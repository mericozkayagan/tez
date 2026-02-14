import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { EncryptedValue } from '@ai-assistant/types';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Derive the 32-byte encryption key from the hex-encoded ENCRYPTION_KEY env var.
 */
function getKey(): Buffer {
    const hex = process.env.ENCRYPTION_KEY;
    if (!hex || hex.length !== 64) {
        throw new Error(
            'ENCRYPTION_KEY must be a 64-char hex string (32 bytes). Generate with: openssl rand -hex 32'
        );
    }
    return Buffer.from(hex, 'hex');
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns the encrypted value, IV, and auth tag as hex strings.
 */
export function encrypt(plaintext: string): EncryptedValue {
    const key = getKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
    };
}

/**
 * Decrypt an AES-256-GCM encrypted value back to plaintext.
 */
export function decrypt(encryptedValue: EncryptedValue): string {
    const key = getKey();
    const iv = Buffer.from(encryptedValue.iv, 'hex');
    const authTag = Buffer.from(encryptedValue.authTag, 'hex');
    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedValue.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

/**
 * Mask a secret for display purposes (e.g., "sk-abc...xyz").
 */
export function maskSecret(secret: string, visibleChars: number = 4): string {
    if (secret.length <= visibleChars * 2) {
        return '****';
    }
    const start = secret.slice(0, visibleChars);
    const end = secret.slice(-visibleChars);
    return `${start}...${end}`;
}
