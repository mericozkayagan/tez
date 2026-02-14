import type { FastifyInstance } from 'fastify';
import { streamText, tool } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { convertToCoreMessages } from 'ai';
import { ChatRequestSchema, type ToolResult, type ToolName } from '@ai-assistant/types';
import { AIKeyRepository, ChatRepository } from '@ai-assistant/db';
import { getAllTools, executeTool } from '@ai-assistant/mcp-tools';
import { authenticate } from '../middleware/auth.js';

const aiKeyRepo = new AIKeyRepository();
const chatRepo = new ChatRepository();

const SYSTEM_PROMPT = `
You are an advanced personal AI assistant with access to the user's external tools (Google Calendar, Drive, Notion, etc.).
Your goal is to help the user efficiently by using these tools.

Rules:
1.  **Always** use the provided tools to fetch information or perform actions when relevant.
2.  If you need more information to call a tool (e.g. missing arguments), ask the user specifically for it.
3.  **Notion Best Practices:**
    *   **Before creating a new page**, ALWAYS search if a relevant page already exists using \`notion_search\`.
    *   If a relevant page is found, use \`notion_append_to_page\` to add content to it instead of creating a duplicate.
    *   Only create a new page if the user explicitly asks for a NEW page or if no relevant page exists after searching.
4.  **Google Drive:**
    *   Use \`google_drive_upload_file\` to save content (notes, code, summaries) to Drive when requested.
5.  Be concise and helpful.
6.  If a tool fails, explain the error to the user and ask how to proceed.
`;

export async function chatRoutes(app: FastifyInstance): Promise<void> {
    // POST /chat - Main chat endpoint
    app.post('/chat', { onRequest: authenticate }, async (request, reply) => {
        const userId = request.userId;
        const parsed = ChatRequestSchema.safeParse(request.body);

        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Validation Error',
                details: parsed.error.flatten().fieldErrors,
            });
        }

        const { messages, conversationId } = parsed.data;

        // 0. Handle Conversation ID & Persistence
        let currentConversationId = conversationId;
        if (!currentConversationId) {
            // New conversation
            // Use first message content as title draft (truncated)
            const firstMsg = messages.find(m => m.role === 'user')?.content || 'New Chat';
            const title = firstMsg.slice(0, 50);
            const conv = await chatRepo.createConversation(userId, title);
            currentConversationId = conv.id;
        } else {
            // Verify ownership
            const conv = await chatRepo.getConversation(currentConversationId, userId);
            if (!conv) {
                return reply.status(404).send({ error: 'Conversation not found' });
            }
        }

        // Save LAST user message (assuming client sends history, we only persist the new one)
        // OR: Ideally, we should sync all? No, that duplicates.
        // We assume the client tracks state, but when sending to backend, valid new endpoint usage implies a new turn.
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.role === 'user') {
            await chatRepo.addMessage(currentConversationId, 'user', lastMessage.content);
        }

        // 1. Get User's AI Key
        const keyData = await aiKeyRepo.getDecryptedKey(userId);
        if (!keyData) {
            return reply.status(400).send({
                error: 'No AI Provider Configured',
                message: 'Please go to settings and configure an AI provider (OpenAI or Anthropic) first.',
            });
        }

        let model;

        if (keyData.provider === 'openai') {
            const openai = createOpenAI({ apiKey: keyData.apiKey });
            model = openai('gpt-4o');
        } else if (keyData.provider === 'anthropic') {
            const anthropic = createAnthropic({ apiKey: keyData.apiKey });
            model = anthropic('claude-3-5-sonnet-20240620');
        } else {
            return reply.status(400).send({ error: 'Invalid AI provider configuration.' });
        }

        // 2. Load Tools
        const mcpTools = getAllTools();
        const aiTools: Record<string, any> = {};

        for (const mcpTool of mcpTools) {
            aiTools[mcpTool.name] = tool({
                description: mcpTool.description,
                parameters: mcpTool.parameters,
                execute: async (params) => {
                    return await executeTool(
                        mcpTool.name as ToolName,
                        userId,
                        params as Record<string, unknown>
                    );
                },
                experimental_toToolResultContent: (result: unknown) => {
                    const toolResult = result as ToolResult;
                    if (toolResult && toolResult.error) {
                        return [{ type: 'text', text: `Error: ${toolResult.error}` }];
                    }
                    return [{ type: 'text', text: JSON.stringify(toolResult && toolResult.data ? toolResult.data : result) }];
                },
            });
        }

        // 3. Stream Response
        const result = await streamText({
            model,
            system: SYSTEM_PROMPT,
            messages: convertToCoreMessages(messages),
            tools: aiTools,
            maxSteps: 5, // Allow multi-step reasoning
            onFinish: async ({ text, toolCalls, toolResults }) => {
                // Save assistant message to history
                // Note: If maxSteps > 1, this captures the interaction. 
                // We might want to save tool outputs too.
                // For MVP: Saving the Assistant's response (including tool calls if any) is crucial.
                await chatRepo.addMessage(
                    currentConversationId!, // valid here
                    'assistant',
                    text || '',
                    toolCalls,
                    toolResults
                );
            }
        });

        // 4. Return as streaming response
        const response = result.toDataStreamResponse();

        reply.type('text/plain; charset=utf-8');
        reply.header('X-Vercel-AI-Data-Stream', 'v1');
        reply.header('X-Conversation-ID', currentConversationId); // Send ID back to client

        if (!response.body) {
            return reply.send('');
        }

        return reply.send(response.body);
    });

    // GET /conversations - List user's conversations
    app.get('/conversations', { onRequest: authenticate }, async (request, reply) => {
        const conversations = await chatRepo.getConversations(request.userId);
        return reply.send({ conversations });
    });

    // GET /conversations/:id - Get conversation details and messages
    app.get('/conversations/:id', { onRequest: authenticate }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const conversation = await chatRepo.getConversation(id, request.userId);
        if (!conversation) {
            return reply.status(404).send({ error: 'Conversation not found' });
        }
        const messages = await chatRepo.getMessages(id);
        return reply.send({ conversation, messages });
    });

    // DELETE /conversations/:id - Delete a conversation
    app.delete('/conversations/:id', { onRequest: authenticate }, async (request, reply) => {
        const { id } = request.params as { id: string };
        await chatRepo.deleteConversation(id, request.userId);
        return reply.send({ message: 'Conversation deleted' });
    });
}
