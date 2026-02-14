import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { RegisterSchema, LoginSchema } from '@ai-assistant/types';
import { UserRepository } from '@ai-assistant/db';

const userRepo = new UserRepository();
const SALT_ROUNDS = 12;

export async function authRoutes(app: FastifyInstance): Promise<void> {
    /**
     * POST /auth/register
     * Create a new user account.
     */
    app.post('/register', async (request, reply) => {
        const parsed = RegisterSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Validation Error',
                details: parsed.error.flatten().fieldErrors,
            });
        }

        const { email, password } = parsed.data;

        // Check if user already exists
        const existing = await userRepo.findByEmail(email);
        if (existing) {
            return reply.status(409).send({
                error: 'Conflict',
                message: 'An account with this email already exists',
            });
        }

        // Hash password and create user
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const user = await userRepo.create(email, passwordHash);

        // Generate JWT
        const token = app.jwt.sign(
            { sub: user.id, email: user.email },
        );

        return reply.status(201).send({
            token,
            user: { id: user.id, email: user.email },
        });
    });

    /**
     * POST /auth/login
     * Authenticate and receive a JWT.
     */
    app.post('/login', async (request, reply) => {
        const parsed = LoginSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Validation Error',
                details: parsed.error.flatten().fieldErrors,
            });
        }

        const { email, password } = parsed.data;

        const user = await userRepo.findByEmail(email);
        if (!user) {
            return reply.status(401).send({
                error: 'Unauthorized',
                message: 'Invalid email or password',
            });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return reply.status(401).send({
                error: 'Unauthorized',
                message: 'Invalid email or password',
            });
        }

        const token = app.jwt.sign(
            { sub: user.id, email: user.email },
        );

        return reply.send({
            token,
            user: { id: user.id, email: user.email },
        });
    });
}
