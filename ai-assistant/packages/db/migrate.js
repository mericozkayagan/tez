/**
 * Simple migration runner – reads schema.sql and applies it to the database.
 * Usage: node packages/db/migrate.js
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('DATABASE_URL is required');
        process.exit(1);
    }

    const client = new pg.Client({ connectionString });
    await client.connect();

    try {
        const schemaPath = resolve(__dirname, 'schema.sql');
        const schema = readFileSync(schemaPath, 'utf-8');
        await client.query(schema);
        console.log('✅ Database schema applied successfully.');
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

migrate();
