import { z } from 'zod';
import type { ToolDefinition, ToolResult } from '@ai-assistant/types';
import { ensureValidToken } from '../token-refresh';
import { IntegrationAPIError } from '../errors';

const notionSearchParams = z.object({
    query: z.string().describe('Search query to find pages, databases, or blocks in Notion'),
    filter: z
        .enum(['page', 'database'])
        .optional()
        .describe('Filter results by object type (page or database)'),
    pageSize: z.number().optional().default(10).describe('Number of results to return'),
});

export const notionSearch: ToolDefinition = {
    name: 'notion_search',
    description:
        'Search across the user\'s Notion workspace. Finds pages and databases by title or content. Returns page titles, URLs, and last edited timestamps.',
    parameters: notionSearchParams,
    async execute(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
        const parsed = notionSearchParams.parse(params);
        const accessToken = await ensureValidToken(userId, 'notion', 'notion_search');

        const body: Record<string, unknown> = {
            query: parsed.query,
            page_size: parsed.pageSize,
            sort: {
                direction: 'descending',
                timestamp: 'last_edited_time',
            },
        };

        if (parsed.filter) {
            body.filter = { value: parsed.filter, property: 'object' };
        }

        const response = await fetch('https://api.notion.com/v1/search', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new IntegrationAPIError(
                'notion_search',
                'Notion',
                response.status,
                errText
            );
        }

        const data = await response.json() as {
            results: Array<{
                id: string;
                object: string;
                url: string;
                last_edited_time: string;
                properties?: Record<string, {
                    title?: Array<{ plain_text: string }>;
                    [key: string]: unknown;
                }>;
                title?: Array<{ plain_text: string }>;
            }>;
        };

        const results = (data.results || []).map((item) => {
            let title = 'Untitled';

            // Extract title from page properties
            if (item.properties) {
                for (const prop of Object.values(item.properties)) {
                    if (prop.title && Array.isArray(prop.title) && prop.title.length > 0) {
                        title = prop.title.map((t) => t.plain_text).join('');
                        break;
                    }
                }
            }

            // For databases, title is at root level
            if (item.title && Array.isArray(item.title) && item.title.length > 0) {
                title = item.title.map((t) => t.plain_text).join('');
            }

            return {
                id: item.id,
                type: item.object,
                title,
                url: item.url,
                lastEdited: item.last_edited_time,
            };
        });

        return { success: true, data: { results, count: results.length } };
    },
};

const notionCreatePageParams = z.object({
    title: z.string().describe('Title of the new page'),
    content: z.string().describe('Content of the page (text or markdown)'),
    parentId: z.string().describe('ID of the parent page or database to create this page inside. REQUIRED.'),
});

export const notionCreatePage: ToolDefinition = {
    name: 'notion_create_page',
    description: 'Create a new page in Notion. You MUST provide a parentId (use notion_search to find a valid parent page or database first).',
    parameters: notionCreatePageParams,
    async execute(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
        const parsed = notionCreatePageParams.parse(params);
        const accessToken = await ensureValidToken(userId, 'notion', 'notion_create_page');

        // Simple text to blocks conversion (paragraph)
        // In a real app, use a markdown-to-notion library
        const blocks = [
            {
                object: 'block',
                type: 'paragraph',
                paragraph: {
                    rich_text: [
                        {
                            type: 'text',
                            text: {
                                content: parsed.content || '',
                            },
                        },
                    ],
                },
            },
        ];

        const body = {
            parent: { page_id: parsed.parentId }, // Assuming parent is a page for now. Could be database_id if we checked.
            properties: {
                title: [
                    {
                        text: {
                            content: parsed.title,
                        },
                    },
                ],
            },
            children: blocks,
        };

        // Handle if parent is database? API differs slightly (properties must match schema).
        // For MVP, assume parent is a PAGE. If it fails, we catch error.

        const response = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new IntegrationAPIError(
                'notion_create_page',
                'Notion',
                response.status,
                errText
            );
        }

        const data = await response.json() as { url: string; id: string };

        return {
            success: true,
            data: {
                message: 'Page created successfully',
                url: data.url,
                id: data.id,
            },
        };
    },
};

const notionAppendToPageParams = z.object({
    pageId: z.string().describe('ID of the page to append content to'),
    content: z.string().describe('Content to append (text or markdown)'),
});

export const notionAppendToPage: ToolDefinition = {
    name: 'notion_append_to_page',
    description: 'Append content to an existing Notion page. Use this when the user wants to add notes to a specific page instead of creating a new one.',
    parameters: notionAppendToPageParams,
    async execute(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
        const parsed = notionAppendToPageParams.parse(params);
        const accessToken = await ensureValidToken(userId, 'notion', 'notion_append_to_page');

        // Simple text to blocks conversion (paragraph)
        const blocks = [
            {
                object: 'block',
                type: 'paragraph',
                paragraph: {
                    rich_text: [
                        {
                            type: 'text',
                            text: {
                                content: parsed.content || '',
                            },
                        },
                    ],
                },
            },
        ];

        const response = await fetch(`https://api.notion.com/v1/blocks/${parsed.pageId}/children`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28',
            },
            body: JSON.stringify({ children: blocks }),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new IntegrationAPIError(
                'notion_append_to_page',
                'Notion',
                response.status,
                errText
            );
        }

        const data = await response.json() as { results: Array<{ id: string }> };

        return {
            success: true,
            data: {
                message: 'Content appended successfully',
                blockId: data.results?.[0]?.id,
            },
        };
    },
};
