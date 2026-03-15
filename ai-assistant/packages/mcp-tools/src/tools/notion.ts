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
    parentId: z.string().describe('ID of the parent page or database. Get this from notion_search results. REQUIRED.'),
    parentType: z.enum(['page', 'database']).optional().default('page').describe('Whether the parent is a page or database (default: page)'),
});

export const notionCreatePage: ToolDefinition = {
    name: 'notion_create_page',
    description: 'Create a new page in Notion. Only use this when the user explicitly requests a NEW page OR when notion_search found no relevant existing page. You MUST have a parentId before calling this — get it from notion_search or ask the user which section to put it in.',
    parameters: notionCreatePageParams,
    async execute(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
        const parsed = notionCreatePageParams.parse(params);
        const accessToken = await ensureValidToken(userId, 'notion', 'notion_create_page');

        // Convert content into paragraph blocks, split by double newlines
        const paragraphs = (parsed.content || '').split(/\n\n+/).filter(p => p.trim());
        const blocks = (paragraphs.length > 0 ? paragraphs : [parsed.content || '']).map((para) => ({
            object: 'block',
            type: 'paragraph',
            paragraph: {
                rich_text: [{ type: 'text', text: { content: para.trim() } }],
            },
        }));

        const parent = parsed.parentType === 'database'
            ? { database_id: parsed.parentId }
            : { page_id: parsed.parentId };

        const body = {
            parent,
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
    pageId: z.string().describe('ID of the page to append content to. Use the ID from notion_search results or a previously created page in this conversation.'),
    content: z.string().describe('Content to append. Use "---" on its own line as a separator before your content to visually separate it from existing content when appropriate.'),
});

// ────────────────────────────────────────────────
// notion_get_page
// ────────────────────────────────────────────────

const notionGetPageParams = z.object({
    pageId: z.string().describe('ID of the Notion page to read (from notion_search results)'),
});

export const notionGetPage: ToolDefinition = {
    name: 'notion_get_page',
    description: 'Read the full content of a Notion page. Use this when the user asks to see what is on a specific page, or before updating it to understand existing content.',
    parameters: notionGetPageParams,
    async execute(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
        const parsed = notionGetPageParams.parse(params);
        const accessToken = await ensureValidToken(userId, 'notion', 'notion_get_page');

        // Fetch page metadata
        const pageResp = await fetch(`https://api.notion.com/v1/pages/${parsed.pageId}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Notion-Version': '2022-06-28',
            },
        });

        if (!pageResp.ok) {
            const errText = await pageResp.text();
            throw new IntegrationAPIError('notion_get_page', 'Notion', pageResp.status, errText);
        }

        const page = await pageResp.json() as {
            id: string;
            url: string;
            properties?: Record<string, { title?: Array<{ plain_text: string }> }>;
        };

        let title = 'Untitled';
        if (page.properties) {
            for (const prop of Object.values(page.properties)) {
                if (prop.title && prop.title.length > 0) {
                    title = prop.title.map(t => t.plain_text).join('');
                    break;
                }
            }
        }

        // Fetch page blocks (content)
        const blocksResp = await fetch(`https://api.notion.com/v1/blocks/${parsed.pageId}/children?page_size=50`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Notion-Version': '2022-06-28',
            },
        });

        if (!blocksResp.ok) {
            const errText = await blocksResp.text();
            throw new IntegrationAPIError('notion_get_page', 'Notion', blocksResp.status, errText);
        }

        const blocksData = await blocksResp.json() as {
            results: Array<{
                type: string;
                [key: string]: unknown;
            }>;
        };

        // Extract text from blocks
        const textBlocks: string[] = [];
        for (const block of blocksData.results || []) {
            const blockContent = block[block.type] as { rich_text?: Array<{ plain_text: string }> } | undefined;
            if (blockContent?.rich_text) {
                const text = blockContent.rich_text.map((t) => t.plain_text).join('');
                if (text.trim()) textBlocks.push(text);
            } else if (block.type === 'divider') {
                textBlocks.push('---');
            }
        }

        return {
            success: true,
            data: {
                id: page.id,
                title,
                url: page.url,
                content: textBlocks.join('\n\n'),
                blockCount: blocksData.results?.length || 0,
            },
        };
    },
};

export const notionAppendToPage: ToolDefinition = {
    name: 'notion_append_to_page',
    description: 'Append content to an existing Notion page. Use this when the user wants to add notes to a specific page instead of creating a new one.',
    parameters: notionAppendToPageParams,
    async execute(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
        const parsed = notionAppendToPageParams.parse(params);
        const accessToken = await ensureValidToken(userId, 'notion', 'notion_append_to_page');

        // Build blocks: if content starts with "---", prepend a divider block
        const blocks: Array<Record<string, unknown>> = [];
        let contentText = parsed.content || '';
        if (contentText.startsWith('---')) {
            blocks.push({ object: 'block', type: 'divider', divider: {} });
            contentText = contentText.replace(/^---\s*\n?/, '');
        }

        // Split into paragraphs by double newline for better structure
        const paragraphs = contentText.split(/\n\n+/).filter(p => p.trim());
        for (const para of paragraphs.length > 0 ? paragraphs : [contentText]) {
            blocks.push({
                object: 'block',
                type: 'paragraph',
                paragraph: {
                    rich_text: [{ type: 'text', text: { content: para.trim() } }],
                },
            });
        }

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
