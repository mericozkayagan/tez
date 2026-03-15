import { z } from 'zod';

// ────────────────────────────────────────────────
// Database Models
// ────────────────────────────────────────────────

export interface User {
    id: string;
    email: string;
    password_hash: string;
    created_at: Date;
    updated_at: Date;
}

export interface AIKey {
    id: string;
    user_id: string;
    provider: AIProvider;
    encrypted_key: string;
    iv: string;
    auth_tag: string;
    created_at: Date;
    updated_at: Date;
}

export interface OAuthAccount {
    id: string;
    user_id: string;
    provider: OAuthProvider;
    encrypted_access_token: string;
    access_token_iv: string;
    access_token_tag: string;
    encrypted_refresh_token: string;
    refresh_token_iv: string;
    refresh_token_tag: string;
    token_expiry: Date;
    scope: string;
    created_at: Date;
    updated_at: Date;
}

// ────────────────────────────────────────────────
// Enums
// ────────────────────────────────────────────────

export type AIProvider = 'openai' | 'anthropic';
export type OAuthProvider = 'google' | 'notion';

export const AI_PROVIDERS: AIProvider[] = ['openai', 'anthropic'];
export const OAUTH_PROVIDERS: OAuthProvider[] = ['google', 'notion'];

// ────────────────────────────────────────────────
// MCP Tools
// ────────────────────────────────────────────────

export type ToolName =
    | 'google_calendar_list_events'
    | 'google_calendar_create_event'
    | 'google_calendar_update_event'
    | 'google_drive_list_files'
    | 'google_drive_upload_file'
    | 'notion_search'
    | 'notion_create_page'
    | 'notion_append_to_page'
    | 'notion_get_page'
    | 'gmail_send_email'
    | 'gmail_list_emails'
    | 'gmail_read_email';

export interface ToolResult {
    success: boolean;
    data?: unknown;
    error?: string;
}

export interface ToolDefinition {
    name: ToolName;
    description: string;
    parameters: z.ZodObject<z.ZodRawShape>;
    execute: (userId: string, params: Record<string, unknown>) => Promise<ToolResult>;
}

// ────────────────────────────────────────────────
// Encrypted Value
// ────────────────────────────────────────────────

export interface EncryptedValue {
    encrypted: string;
    iv: string;
    authTag: string;
}

// ────────────────────────────────────────────────
// Chat
// ────────────────────────────────────────────────

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    tool_call_id?: string;
    name?: string;
}

export const ChatRequestSchema = z.object({
    messages: z.array(
        z.object({
            role: z.enum(['user', 'assistant', 'system', 'tool']),
            content: z.string(),
            tool_call_id: z.string().optional(),
            name: z.string().optional(),
        })
    ),
    conversationId: z.string().optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

// ────────────────────────────────────────────────
// API Validation Schemas
// ────────────────────────────────────────────────

export const RegisterSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const LoginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
});

export const AIKeySchema = z.object({
    provider: z.enum(['openai', 'anthropic']),
    apiKey: z.string().min(10, 'API key is too short'),
});

export const OAuthCallbackSchema = z.object({
    code: z.string(),
    state: z.string().optional(),
});

// ────────────────────────────────────────────────
// API Responses
// ────────────────────────────────────────────────

export interface AuthResponse {
    token: string;
    user: {
        id: string;
        email: string;
    };
}

export interface AIKeyInfo {
    provider: AIProvider;
    maskedKey: string;
    createdAt: Date;
}

export interface OAuthConnection {
    provider: OAuthProvider;
    connected: boolean;
    scope?: string;
    connectedAt?: Date;
}

// ────────────────────────────────────────────────
// Environment
// ────────────────────────────────────────────────

export const EnvSchema = z.object({
    DATABASE_URL: z.string().url(),
    ENCRYPTION_KEY: z.string().length(64, 'Must be 32-byte hex (64 chars)'),
    JWT_SECRET: z.string().min(16),
    JWT_EXPIRES_IN: z.string().default('7d'),
    BACKEND_PORT: z.coerce.number().default(3001),
    FRONTEND_URL: z.string().url(),
    BACKEND_URL: z.string().url(),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    GOOGLE_REDIRECT_URI: z.string().url(),
    NOTION_CLIENT_ID: z.string().min(1),
    NOTION_CLIENT_SECRET: z.string().min(1),
    NOTION_REDIRECT_URI: z.string().url(),
    RATE_LIMIT_MAX: z.coerce.number().default(100),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof EnvSchema>;
