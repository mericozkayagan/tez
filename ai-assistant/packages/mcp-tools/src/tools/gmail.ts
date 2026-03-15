import { z } from 'zod';
import type { ToolDefinition, ToolResult } from '@ai-assistant/types';
import { ensureValidToken } from '../token-refresh';
import { IntegrationAPIError } from '../errors';

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
