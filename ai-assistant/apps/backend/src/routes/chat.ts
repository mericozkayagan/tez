import type { FastifyInstance } from 'fastify';
import { streamText, generateText, tool } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { convertToCoreMessages } from 'ai';
import { ChatRequestSchema, type ToolResult, type ToolName } from '@ai-assistant/types';
import { AIKeyRepository, ChatRepository } from '@ai-assistant/db';
import { getAllTools, executeTool } from '@ai-assistant/mcp-tools';
import { authenticate } from '../middleware/auth.js';
import { buildSystemPrompt } from '../systemPrompt.js';

const aiKeyRepo = new AIKeyRepository();
const chatRepo = new ChatRepository();

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
        const isNewConversation = !currentConversationId;

        if (!currentConversationId) {
            // Temporary title — will be replaced by AI-generated one in onFinish
            const firstMsg = messages.find(m => m.role === 'user')?.content || 'New Chat';
            const tempTitle = firstMsg.slice(0, 50);
            const conv = await chatRepo.createConversation(userId, tempTitle);
            currentConversationId = conv.id;
        } else {
            const conv = await chatRepo.getConversation(currentConversationId, userId);
            if (!conv) {
                return reply.status(404).send({ error: 'Conversation not found' });
            }
        }

        // Save LAST user message
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
        const aiTools: Record<string, ReturnType<typeof tool>> = {};

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

        // Capture for use in onFinish closure
        const capturedConversationId = currentConversationId;
        const capturedModel = model;
        const userMessage = lastMessage?.content || '';

        // 3. Stream Response
        const result = await streamText({
            model,
            system: buildSystemPrompt(),
            messages: convertToCoreMessages(messages),
            tools: aiTools,
            maxSteps: 5,
            abortSignal: AbortSignal.timeout(120_000),
            onFinish: async ({ text, toolCalls, toolResults }) => {
                await chatRepo.addMessage(
                    capturedConversationId,
                    'assistant',
                    text || '',
                    toolCalls,
                    toolResults
                );

                // Generate AI title for new conversations (fire-and-forget)
                if (isNewConversation && userMessage) {
                    generateText({
                        model: capturedModel,
                        messages: [{
                            role: 'user',
                            content: 'Generate a short conversation title (max 5 words, no quotes) for a chat that starts with this message: "' + userMessage.slice(0, 200) + '". Reply with ONLY the title.',
                        }],
                        maxTokens: 15,
                    }).then(({ text: title }) => {
                        if (title?.trim()) {
                            chatRepo.updateTitle(capturedConversationId, title.trim()).catch(() => {});
                        }
                    }).catch(() => {});
                }
            }
        });

        // 4. Return as streaming response
        const response = result.toDataStreamResponse();

        reply.type('text/plain; charset=utf-8');
        reply.header('X-Vercel-AI-Data-Stream', 'v1');
        reply.header('X-Conversation-ID', currentConversationId);

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
