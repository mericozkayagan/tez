import { z } from 'zod';
import type { ToolDefinition, ToolResult } from '@ai-assistant/types';
import { ensureValidToken } from '../token-refresh';
import { IntegrationAPIError } from '../errors';

// ────────────────────────────────────────────────
// gmail_list_emails
// ────────────────────────────────────────────────

const listEmailsParams = z.object({
    query: z.string().optional().describe('Gmail search query (e.g. "after:2026/03/15", "is:unread", "from:someone@example.com"). Leave empty for recent inbox.'),
    maxResults: z.number().optional().default(20).describe('Maximum number of emails to return (default 20)'),
});

export const gmailListEmails: ToolDefinition = {
    name: 'gmail_list_emails',
    description:
        "List and read emails from the user's Gmail inbox. Use this to fetch, summarize, or categorize emails. Always display results directly in the chat — never send an email to report them.",
    parameters: listEmailsParams,
    async execute(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
        const parsed = listEmailsParams.parse(params);
        const accessToken = await ensureValidToken(userId, 'google', 'gmail_list_emails');

        // Step 1: list matching message IDs
        const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
        if (parsed.query) listUrl.searchParams.set('q', parsed.query);
        listUrl.searchParams.set('maxResults', String(parsed.maxResults));

        const listResp = await fetch(listUrl.toString(), {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!listResp.ok) {
            const err = await listResp.text();
            throw new IntegrationAPIError('gmail_list_emails', 'Gmail', listResp.status, err);
        }

        const listData = await listResp.json() as { messages?: Array<{ id: string }> };
        const ids = listData.messages || [];

        if (ids.length === 0) {
            return { success: true, data: { emails: [], count: 0 } };
        }

        // Step 2: fetch metadata for each message (subject, from, date, snippet)
        const emails = await Promise.all(
            ids.slice(0, parsed.maxResults).map(async ({ id }) => {
                const msgResp = await fetch(
                    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
                    { headers: { Authorization: `Bearer ${accessToken}` } }
                );
                if (!msgResp.ok) return null;

                const msg = await msgResp.json() as {
                    id: string;
                    snippet: string;
                    payload: { headers: Array<{ name: string; value: string }> };
                    labelIds: string[];
                };

                const headers = msg.payload?.headers || [];
                const get = (name: string) => headers.find(h => h.name === name)?.value || '';

                return {
                    id: msg.id,
                    subject: get('Subject') || '(no subject)',
                    from: get('From'),
                    date: get('Date'),
                    snippet: msg.snippet,
                    unread: msg.labelIds?.includes('UNREAD') ?? false,
                };
            })
        );

        const validEmails = emails.filter(Boolean);
        return { success: true, data: { emails: validEmails, count: validEmails.length } };
    },
};

// ────────────────────────────────────────────────
// gmail_send_email
// ────────────────────────────────────────────────

const sendEmailParams = z.object({
    to: z.string().describe('Recipient email address'),
    subject: z.string().describe('Email subject'),
    body: z.string().describe('Email body (plain text)'),
    cc: z.string().optional().describe('CC email address (optional)'),
});

export const gmailSendEmail: ToolDefinition = {
    name: 'gmail_send_email',
    description:
        "Send an email via the user's Gmail account. Use this when the user wants to email someone — e.g. sharing a summary, notifying about a meeting, or following up.",
    parameters: sendEmailParams,
    async execute(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
        const parsed = sendEmailParams.parse(params);
        const accessToken = await ensureValidToken(userId, 'google', 'gmail_send_email');

        // Build RFC 2822 message
        const lines: string[] = [
            `To: ${parsed.to}`,
            `Subject: ${parsed.subject}`,
            'Content-Type: text/plain; charset=utf-8',
            'MIME-Version: 1.0',
        ];
        if (parsed.cc) {
            lines.push(`Cc: ${parsed.cc}`);
        }
        lines.push('');
        lines.push(parsed.body);

        const rawMessage = lines.join('\r\n');

        // Base64url encode (Gmail API requires this)
        const encoded = Buffer.from(rawMessage)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        const response = await fetch(
            'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ raw: encoded }),
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            throw new IntegrationAPIError(
                'gmail_send_email',
                'Gmail',
                response.status,
                errText
            );
        }

        const data = await response.json() as { id: string; threadId: string };

        return {
            success: true,
            data: {
                message: `Email sent successfully to ${parsed.to}`,
                messageId: data.id,
                threadId: data.threadId,
            },
        };
    },
};
