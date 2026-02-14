import {
    Calendar,
    CheckCircle2,
    FileText,
    ExternalLink,
    HardDrive,
    Search,
} from 'lucide-react';

interface ToolResultProps {
    toolName: string;
    result: any;
    args: any;
}

export default function ToolResult({ toolName, result, args }: ToolResultProps) {
    if (!result) return null;

    // Parse result if string
    let data = result;
    if (typeof result === 'string') {
        try {
            data = JSON.parse(result);
        } catch (e) {
            data = { message: result };
        }
    }

    // Google Calendar: Create Event
    if (toolName === 'google_calendar_create_event') {
        // Backend returns: { title, link, start, end }
        const eventLink = data.link || data.htmlLink;
        const summary = args.summary;
        const startTime = args.startDateTime;

        return (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex items-start gap-3 mt-2">
                <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                    <Calendar className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-blue-200 text-sm">Event Created</div>
                    <div className="text-white font-semibold truncate">{summary}</div>
                    <div className="text-white/50 text-xs mt-0.5">{startTime ? new Date(startTime).toLocaleString() : ''}</div>
                    {eventLink && (
                        <a href={eventLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-400 mt-2 hover:underline">
                            View in Calendar <ExternalLink className="w-3 h-3" />
                        </a>
                    )}
                </div>
            </div>
        );
    }

    // Google Drive: Upload File
    if (toolName === 'google_drive_upload_file') {
        const fileLink = data.webViewLink;
        const fileName = args.filename;

        return (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 flex items-start gap-3 mt-2">
                <div className="p-2 bg-green-500/20 rounded-lg text-green-400">
                    <HardDrive className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-green-200 text-sm">File Uploaded</div>
                    <div className="text-white font-semibold truncate">{fileName}</div>
                    {fileLink && (
                        <a href={fileLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-green-400 mt-2 hover:underline">
                            Open in Drive <ExternalLink className="w-3 h-3" />
                        </a>
                    )}
                </div>
            </div>
        );
    }

    // Notion: Create/Append Page
    if (toolName === 'notion_create_page' || toolName === 'notion_append_to_page') {
        const pageUrl = data.url;
        const title = args.title || 'Notion Page';

        return (
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 flex items-start gap-3 mt-2">
                <div className="p-2 bg-orange-500/20 rounded-lg text-orange-400">
                    <FileText className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-orange-200 text-sm">
                        {toolName === 'notion_create_page' ? 'Page Created' : 'Content Appended'}
                    </div>
                    {toolName === 'notion_create_page' && <div className="text-white font-semibold truncate">{title}</div>}
                    {pageUrl && (
                        <a href={pageUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-orange-400 mt-2 hover:underline">
                            Open in Notion <ExternalLink className="w-3 h-3" />
                        </a>
                    )}
                </div>
            </div>
        );
    }

    // Default: Generic Tool Result
    return (
        <div className="text-xs bg-black/20 rounded-lg p-2 border border-white/5">
            <div className="flex items-center gap-2 mb-1 opacity-60">
                <CheckCircle2 className="w-3 h-3 text-primary-400" />
                <span>Executed: {toolName}</span>
            </div>
            {/* <div className="max-h-20 overflow-y-auto opacity-50 font-mono">{JSON.stringify(data).slice(0, 100)}...</div> */}
        </div>
    );
}
