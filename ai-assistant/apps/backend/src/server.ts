import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(import.meta.dirname, '../../../.env') });
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import { EnvSchema } from '@ai-assistant/types';
import { authRoutes } from './routes/auth';
import { settingsRoutes } from './routes/settings';
import { oauthRoutes } from './routes/oauth';
import { chatRoutes } from './routes/chat';

// ── Validate environment variables on startup ──
const envResult = EnvSchema.safeParse(process.env);
if (!envResult.success) {
    console.error('❌ Invalid environment variables:');
    console.error(envResult.error.format());
    process.exit(1);
}
const env = envResult.data;

// ── Create Fastify instance ──
const app = Fastify({
    logger: {
        level: env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport: undefined,
    },
});

// ── Plugins ──
await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production',
});

await app.register(cors, {
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['X-Conversation-ID'],
});

await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
});

await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_EXPIRES_IN },
});

// ── Decorate request with userId ──
app.decorateRequest('userId', '');

// ── Health check ──
app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
}));

// ── Routes ──
await app.register(authRoutes, { prefix: '/auth' });
await app.register(settingsRoutes, { prefix: '/settings' });
await app.register(oauthRoutes, { prefix: '/oauth' });
await app.register(chatRoutes, { prefix: '/api' });

// ── Start ──
try {
    await app.listen({ port: env.BACKEND_PORT, host: '0.0.0.0' });
    console.log(`🚀 Backend running on http://localhost:${env.BACKEND_PORT}`);
} catch (err) {
    app.log.error(err);
    process.exit(1);
}

export default app;
