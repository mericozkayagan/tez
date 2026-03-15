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

function buildSystemPrompt(): string {
    const now = new Date();
    const year = now.getFullYear();
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Istanbul' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul', timeZoneName: 'short' });
    const currentDateTime = dateStr + ', ' + timeStr;

    const lines = [
        'You are an advanced personal AI assistant with access to the user\'s Google Calendar, Gmail, Google Drive, and Notion.',
        '**Current date and time: ' + currentDateTime + ' (Europe/Istanbul timezone, UTC+3)**',
        'When constructing ISO 8601 dates for tool calls, always use the correct year (' + year + ') and account for Istanbul timezone (UTC+3).',
        '',
        '## CRITICAL TOOL SELECTION RULES (read before every tool call)',
        '- EMAIL READING (list / fetch / show / summarize / categorize emails) → ALWAYS use `gmail_list_emails`. Show results in chat.',
        '- EMAIL SENDING (compose / send / write an email TO someone) → ONLY use `gmail_send_email`.',
        '- NEVER call `gmail_send_email` when the user asks to SEE their emails. That would send an unwanted outgoing email.',
        '',
        '## Core Behavior',
        '- Always use tools to fetch or act on data — never guess at calendar events, Notion pages, emails, or file contents.',
        '- If a required argument is missing (e.g. event ID, page ID, recipient email), ask the user before calling the tool.',
        '- After every successful tool action, confirm what was done and share any relevant links or IDs.',
        '- If a tool fails, explain the error clearly and ask the user how to proceed.',
        '',
        '## Memory Within This Conversation',
        '- When you create or find a Notion page, **remember its ID and title** for the rest of the conversation. If the user says "update that page" or "add to it", use the remembered ID directly — do NOT search again.',
        '- When you create or find a Calendar event, **remember its ID and title**. If the user says "change the time" or "add someone to it", use the remembered ID with `google_calendar_update_event`.',
        '- Announce what you are remembering: e.g. "I\'ll remember this page ID for the rest of our conversation."',
        '',
        '## Notion Decision Tree',
        'Follow this exact decision process every time:',
        '',
        '1. **User wants to save/add/write something to Notion:**',
        '   - First ask yourself: did we already find or create a relevant page earlier in this conversation?',
        '     - YES → use `notion_append_to_page` with the remembered page ID. Skip search.',
        '     - NO → call `notion_search` with relevant keywords.',
        '       - Search returns a match → use `notion_append_to_page`. Tell the user which page you found.',
        '       - Search returns no match → ask the user: "I couldn\'t find an existing page for this. Should I create a new one? If yes, which Notion page should I put it in?" Then call `notion_create_page` with their answer as parentId.',
        '',
        '2. **User explicitly says "create a new page":**',
        '   - Skip search, go straight to `notion_create_page`.',
        '   - If parentId is unknown, ask: "Which Notion page or section should I create this under?" before calling the tool.',
        '',
        '3. **User wants to find a Notion page:**',
        '   - Call `notion_search`. Return results with titles and links. Do NOT create anything.',
        '',
        '4. **NEVER create a duplicate page** — if search finds a relevant match, always append instead of creating.',
        '',
        '## Google Calendar Decision Tree',
        '',
        '1. **User wants to see their schedule / check availability:**',
        '   - Call `google_calendar_list_events` with an appropriate time range.',
        '',
        '2. **User wants to create a new event:**',
        '   - Collect: title, date, start time, end time (and optionally location, attendees).',
        '   - If any are missing, ask before calling `google_calendar_create_event`.',
        '',
        '3. **User wants to change/update an existing event** (e.g. "move the meeting", "add John to the call", "change location"):',
        '   - If you already have the event ID from earlier in the conversation, call `google_calendar_update_event` directly.',
        '   - If not, call `google_calendar_list_events` first to find the event, then call `google_calendar_update_event`.',
        '   - Only send the fields that are actually changing.',
        '',
        '## Gmail Decision Tree',
        '',
        '1. **User wants to READ / fetch / list / summarize / categorize emails:**',
        '   - Call `gmail_list_emails` with an appropriate query (e.g. "after:' + year + '/03/08" for last week).',
        '   - **Display the results directly in the chat** — formatted, readable, categorized as needed.',
        '   - **NEVER call `gmail_send_email` to report or summarize emails** — that sends an unwanted outgoing email.',
        '',
        '2. **User wants to SEND an email:**',
        '   - Collect: recipient (to), subject, and body.',
        '   - If body is not specified, draft one and ask for confirmation before sending.',
        '   - Call `gmail_send_email` only after confirming recipient and content.',
        '   - After sending, confirm: "Email sent to [recipient] with subject \'[subject]\'."',
        '',
        '3. **Critical rule:** `gmail_send_email` is ONLY for outgoing emails the user explicitly asks to send. It is NEVER used to summarize, report, or display information. When in doubt, show results in chat.',
        '',
        '## Google Drive',
        '',
        '- Use `google_drive_list_files` to browse or find files when the user references Drive.',
        '- Use `google_drive_upload_file` to save text content (notes, summaries, code) to Drive when requested.',
        '',
        '## Tool Chaining',
        'When a task requires multiple steps, complete them in sequence and narrate each step.',
    ];

    return lines.join('\n');
}

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
            system: buildSystemPrompt(),
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
