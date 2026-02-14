import { getPool } from '../client';
import type { User } from '@ai-assistant/types';

export class UserRepository {
    /**
     * Create a new user.
     */
    async create(email: string, passwordHash: string): Promise<User> {
        const pool = getPool();
        const result = await pool.query<User>(
            `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id, email, password_hash, created_at, updated_at`,
            [email, passwordHash]
        );
        return result.rows[0];
    }

    /**
     * Find a user by email.
     */
    async findByEmail(email: string): Promise<User | null> {
        const pool = getPool();
        const result = await pool.query<User>(
            `SELECT id, email, password_hash, created_at, updated_at
       FROM users WHERE email = $1`,
            [email]
        );
        return result.rows[0] || null;
    }

    /**
     * Find a user by ID.
     */
    async findById(id: string): Promise<User | null> {
        const pool = getPool();
        const result = await pool.query<User>(
            `SELECT id, email, password_hash, created_at, updated_at
       FROM users WHERE id = $1`,
            [id]
        );
        return result.rows[0] || null;
    }
}
