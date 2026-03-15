import { getPool } from '../client';

export interface Conversation {
    id: string;
    title: string;
    created_at: Date;
    updated_at: Date;
}

export interface StoredToolCall {
    toolCallId: string;
    toolName: string;
    args: Record<string, unknown>;
}

export interface StoredToolResult {
    toolCallId: string;
    toolName: string;
    args: Record<string, unknown>;
    result: unknown;
}

export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    tool_calls?: StoredToolCall[];
    tool_results?: StoredToolResult[];
    created_at: Date;
}

export class ChatRepository {
    private get pool() {
        return getPool();
    }

    async createConversation(userId: string, title: string = 'New Chat'): Promise<Conversation> {
        const result = await this.pool.query(
            `INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING id, title, created_at, updated_at`,
            [userId, title]
        );
        return result.rows[0];
    }

    async getConversations(userId: string): Promise<Conversation[]> {
        const result = await this.pool.query(
            `SELECT id, title, created_at, updated_at FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC`,
            [userId]
        );
        return result.rows;
    }

    async getConversation(id: string, userId: string): Promise<Conversation | null> {
        const result = await this.pool.query(
            `SELECT id, title, created_at, updated_at FROM conversations WHERE id = $1 AND user_id = $2`,
            [id, userId]
        );
        return result.rows[0] || null;
    }

    async addMessage(
        conversationId: string,
        role: string,
        content: string,
        toolCalls?: StoredToolCall[],
        toolResults?: StoredToolResult[]
    ): Promise<Message> {
        const result = await this.pool.query(
            `INSERT INTO messages (conversation_id, role, content, tool_calls, tool_results)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, role, content, tool_calls, tool_results, created_at`,
            [
                conversationId,
                role,
                content,
                toolCalls ? JSON.stringify(toolCalls) : null,
                toolResults ? JSON.stringify(toolResults) : null,
            ]
        );

        // Update conversation updated_at
        await this.pool.query(
            `UPDATE conversations SET updated_at = NOW() WHERE id = $1`,
            [conversationId]
        );

        return result.rows[0];
    }

    async getMessages(conversationId: string): Promise<Message[]> {
        const result = await this.pool.query(
            `SELECT id, role, content, tool_calls, tool_results, created_at
             FROM messages
             WHERE conversation_id = $1
             ORDER BY created_at ASC`,
            [conversationId]
        );
        return result.rows.map(row => ({
            ...row,
            tool_calls: row.tool_calls,
            tool_results: row.tool_results
        }));
    }

    async deleteConversation(id: string, userId: string): Promise<void> {
        await this.pool.query(
            `DELETE FROM conversations WHERE id = $1 AND user_id = $2`,
            [id, userId]
        );
    }
}
