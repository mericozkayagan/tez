import { z } from 'zod';
import type { ToolDefinition, ToolResult } from '@ai-assistant/types';
import { ensureValidToken } from '../token-refresh';
import { IntegrationAPIError } from '../errors';

const listFilesParams = z.object({
    query: z.string().optional().describe('Search query to filter files (Google Drive search syntax)'),
    maxResults: z.number().optional().default(20).describe('Maximum number of files to return'),
    mimeType: z
        .string()
        .optional()
        .describe('Filter by MIME type (e.g. application/pdf, image/png)'),
    orderBy: z
        .enum(['modifiedTime desc', 'name', 'createdTime desc', 'folder'])
        .optional()
        .default('modifiedTime desc')
        .describe('Sort order for results'),
});

export const googleDriveListFiles: ToolDefinition = {
    name: 'google_drive_list_files',
    description:
        'List files from the user\'s Google Drive. Supports searching by query, filtering by MIME type, and sorting. Returns file names, types, sizes, and links.',
    parameters: listFilesParams,
    async execute(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
        const parsed = listFilesParams.parse(params);
        const accessToken = await ensureValidToken(userId, 'google', 'google_drive_list_files');

        const url = new URL('https://www.googleapis.com/drive/v3/files');
        url.searchParams.set('pageSize', String(parsed.maxResults));
        url.searchParams.set('fields', 'files(id,name,mimeType,size,modifiedTime,webViewLink,iconLink)');
        url.searchParams.set('orderBy', parsed.orderBy);

        // Build the q parameter
        const qParts: string[] = [];
        if (parsed.query) {
            qParts.push(`fullText contains '${parsed.query.replace(/'/g, "\\'")}'`);
        }
        if (parsed.mimeType) {
            qParts.push(`mimeType = '${parsed.mimeType}'`);
        }
        qParts.push('trashed = false');

        url.searchParams.set('q', qParts.join(' and '));

        const response = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new IntegrationAPIError(
                'google_drive_list_files',
                'Google Drive',
                response.status,
                errText
            );
        }

        const data = await response.json() as {
            files: Array<{
                id: string;
                name: string;
                mimeType: string;
                size?: string;
                modifiedTime: string;
                webViewLink: string;
                iconLink: string;
            }>;
        };

        const files = (data.files || []).map((file) => ({
            id: file.id,
            name: file.name,
            type: file.mimeType,
            size: file.size ? `${(parseInt(file.size) / 1024).toFixed(1)} KB` : 'N/A',
            modifiedAt: file.modifiedTime,
            link: file.webViewLink,
        }));

        return { success: true, data: { files, count: files.length } };
    },
};

const uploadFileParams = z.object({
    filename: z.string().describe('Name of the file to create'),
    content: z.string().describe('Text content of the file'),
    mimeType: z.string().optional().default('text/plain').describe('MIME type of the file (default: text/plain)'),
    folderId: z.string().optional().describe('ID of the folder to upload to (optional)'),
});

export const googleDriveUploadFile: ToolDefinition = {
    name: 'google_drive_upload_file',
    description: 'Upload a file to Google Drive. Creates a new file with the specified name and content. Useful for saving notes, reports, or code generated in the chat.',
    parameters: uploadFileParams,
    async execute(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
        const parsed = uploadFileParams.parse(params);
        const accessToken = await ensureValidToken(userId, 'google', 'google_drive_upload_file');

        const metadata = {
            name: parsed.filename,
            mimeType: parsed.mimeType,
            parents: parsed.folderId ? [parsed.folderId] : undefined,
        };

        const boundary = '-------314159265358979323846';
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelim = `\r\n--${boundary}--`;

        const multipartRequestBody =
            delimiter +
            'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            `Content-Type: ${parsed.mimeType}\r\n\r\n` +
            parsed.content +
            closeDelim;

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body: multipartRequestBody,
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new IntegrationAPIError(
                'google_drive_upload_file',
                'Google Drive',
                response.status,
                errText
            );
        }

        const data = await response.json() as { id: string; name: string; webViewLink: string };

        return {
            success: true,
            data: {
                message: 'File uploaded successfully',
                fileId: data.id,
                name: data.name,
                link: data.webViewLink,
            },
        };
    },
};
