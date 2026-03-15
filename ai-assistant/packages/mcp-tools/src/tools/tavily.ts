import { z } from 'zod';
import type { ToolDefinition, ToolResult } from '@ai-assistant/types';

const tavilySearchParams = z.object({
    query: z.string().describe('Search query — be specific for better results'),
    maxResults: z.number().optional().default(5).describe('Number of results to return (default 5)'),
    searchDepth: z.enum(['basic', 'advanced']).optional().default('basic').describe('"advanced" for deeper research, "basic" for quick lookups'),
    includeAnswer: z.boolean().optional().default(true).describe('Include an AI-generated answer summary'),
});

export const tavilySearch: ToolDefinition = {
    name: 'web_search',
    description:
        'Search the web for current information, news, facts, documentation, or anything that requires up-to-date data from the internet. Use this when the user asks about recent events, latest versions, real-world facts, or when you do not have enough information.',
    parameters: tavilySearchParams,
    async execute(_userId: string, params: Record<string, unknown>): Promise<ToolResult> {
        const parsed = tavilySearchParams.parse(params);
        const apiKey = process.env.TAVILY_API_KEY;

        if (!apiKey) {
            return { success: false, error: 'Web search is not configured (missing TAVILY_API_KEY).' };
        }

        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                query: parsed.query,
                max_results: parsed.maxResults,
                search_depth: parsed.searchDepth,
                include_answer: parsed.includeAnswer,
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            return { success: false, error: `Web search failed (${response.status}): ${err}` };
        }

        const data = await response.json() as {
            answer?: string;
            results: Array<{
                title: string;
                url: string;
                content: string;
                score: number;
            }>;
        };

        return {
            success: true,
            data: {
                answer: data.answer || null,
                results: (data.results || []).map(r => ({
                    title: r.title,
                    url: r.url,
                    snippet: r.content.slice(0, 600),
                })),
                count: data.results?.length || 0,
            },
        };
    },
};
