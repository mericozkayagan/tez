import type { ToolDefinition, ToolName, ToolResult } from '@ai-assistant/types';
import { ToolExecutionError } from './errors';
import { googleCalendarListEvents, googleCalendarCreateEvent } from './tools/google-calendar';
import { googleDriveListFiles, googleDriveUploadFile } from './tools/google-drive';
import { notionSearch, notionCreatePage, notionAppendToPage } from './tools/notion';

/**
 * Registry mapping tool names to their definitions.
 */
const toolRegistry = new Map<ToolName, ToolDefinition>([
    ['google_calendar_list_events', googleCalendarListEvents],
    ['google_calendar_create_event', googleCalendarCreateEvent],
    ['google_drive_list_files', googleDriveListFiles],
    ['google_drive_upload_file', googleDriveUploadFile],
    ['notion_search', notionSearch],
    ['notion_create_page', notionCreatePage],
    ['notion_append_to_page', notionAppendToPage],
]);

/**
 * Get all registered tool definitions (for injecting into AI).
 */
export function getAllTools(): ToolDefinition[] {
    return Array.from(toolRegistry.values());
}

/**
 * Get a specific tool by name.
 */
export function getTool(name: ToolName): ToolDefinition | undefined {
    return toolRegistry.get(name);
}

/**
 * Execute a tool by name for a specific user.
 * Handles user-scoped token retrieval internally.
 */
export async function executeTool(
    name: ToolName,
    userId: string,
    params: Record<string, unknown>
): Promise<ToolResult> {
    const tool = toolRegistry.get(name);
    if (!tool) {
        throw new ToolExecutionError(name, `Unknown tool: ${name}`, 404);
    }

    try {
        return await tool.execute(userId, params);
    } catch (error) {
        if (error instanceof ToolExecutionError) {
            throw error;
        }
        const message = error instanceof Error ? error.message : 'Unknown error during tool execution';
        throw new ToolExecutionError(name, message);
    }
}
