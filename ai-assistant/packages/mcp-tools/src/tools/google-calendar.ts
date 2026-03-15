import { z } from 'zod';
import type { ToolDefinition, ToolResult } from '@ai-assistant/types';
import { ensureValidToken } from '../token-refresh';
import { IntegrationAPIError } from '../errors';

// ────────────────────────────────────────────────
// google_calendar_list_events
// ────────────────────────────────────────────────

const listEventsParams = z.object({
    timeMin: z.string().describe('Start of time range (ISO 8601 format, e.g. 2025-01-01T00:00:00Z)'),
    timeMax: z.string().describe('End of time range (ISO 8601 format)'),
    maxResults: z.number().optional().default(10).describe('Maximum number of events to return'),
});

export const googleCalendarListEvents: ToolDefinition = {
    name: 'google_calendar_list_events',
    description:
        'List events from the user\'s Google Calendar within a specified time range. Returns event titles, dates, locations, and attendees.',
    parameters: listEventsParams,
    async execute(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
        const parsed = listEventsParams.parse(params);
        const accessToken = await ensureValidToken(userId, 'google', 'google_calendar_list_events');

        const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
        url.searchParams.set('timeMin', parsed.timeMin);
        url.searchParams.set('timeMax', parsed.timeMax);
        url.searchParams.set('maxResults', String(parsed.maxResults));
        url.searchParams.set('singleEvents', 'true');
        url.searchParams.set('orderBy', 'startTime');

        const response = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new IntegrationAPIError(
                'google_calendar_list_events',
                'Google Calendar',
                response.status,
                errText
            );
        }

        const data = await response.json() as {
            items: Array<{
                id: string;
                summary: string;
                start: { dateTime?: string; date?: string };
                end: { dateTime?: string; date?: string };
                location?: string;
                attendees?: Array<{ email: string; responseStatus: string }>;
                htmlLink: string;
            }>;
        };

        const events = (data.items || []).map((event) => ({
            id: event.id,
            title: event.summary,
            start: event.start.dateTime || event.start.date,
            end: event.end.dateTime || event.end.date,
            location: event.location || null,
            attendees: (event.attendees || []).map((a) => ({
                email: a.email,
                status: a.responseStatus,
            })),
            link: event.htmlLink,
        }));

        return { success: true, data: { events, count: events.length } };
    },
};

// ────────────────────────────────────────────────
// google_calendar_update_event
// ────────────────────────────────────────────────

const updateEventParams = z.object({
    eventId: z.string().describe('ID of the event to update (from google_calendar_list_events)'),
    summary: z.string().optional().describe('New event title'),
    description: z.string().optional().describe('New event description'),
    startDateTime: z.string().optional().describe('New start time (ISO 8601, e.g. 2025-03-15T10:00:00+03:00)'),
    endDateTime: z.string().optional().describe('New end time (ISO 8601)'),
    location: z.string().optional().describe('New event location'),
    attendees: z.array(z.string().email()).optional().describe('New list of attendee emails (replaces existing)'),
    timeZone: z.string().optional().default('UTC').describe('Time zone (e.g. Europe/Istanbul)'),
});

export const googleCalendarUpdateEvent: ToolDefinition = {
    name: 'google_calendar_update_event',
    description:
        'Update an existing event on the user\'s Google Calendar. Use google_calendar_list_events first to get the event ID. Only provided fields will be updated.',
    parameters: updateEventParams,
    async execute(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
        const parsed = updateEventParams.parse(params);
        const accessToken = await ensureValidToken(userId, 'google', 'google_calendar_update_event');

        const body: Record<string, unknown> = {};
        if (parsed.summary !== undefined) body.summary = parsed.summary;
        if (parsed.description !== undefined) body.description = parsed.description;
        if (parsed.location !== undefined) body.location = parsed.location;
        if (parsed.startDateTime !== undefined) {
            body.start = { dateTime: parsed.startDateTime, timeZone: parsed.timeZone };
        }
        if (parsed.endDateTime !== undefined) {
            body.end = { dateTime: parsed.endDateTime, timeZone: parsed.timeZone };
        }
        if (parsed.attendees !== undefined) {
            body.attendees = parsed.attendees.map((email) => ({ email }));
        }

        const response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events/${parsed.eventId}`,
            {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            throw new IntegrationAPIError(
                'google_calendar_update_event',
                'Google Calendar',
                response.status,
                errText
            );
        }

        const updated = await response.json() as {
            id: string;
            summary: string;
            htmlLink: string;
            start: { dateTime?: string; date?: string };
            end: { dateTime?: string; date?: string };
            location?: string;
        };

        return {
            success: true,
            data: {
                id: updated.id,
                title: updated.summary,
                link: updated.htmlLink,
                start: updated.start.dateTime || updated.start.date,
                end: updated.end.dateTime || updated.end.date,
                location: updated.location || null,
                message: 'Event updated successfully',
            },
        };
    },
};

// ────────────────────────────────────────────────
// google_calendar_create_event
// ────────────────────────────────────────────────

const createEventParams = z.object({
    summary: z.string().describe('Event title'),
    description: z.string().optional().describe('Event description'),
    startDateTime: z.string().describe('Event start (ISO 8601, e.g. 2025-03-15T10:00:00+03:00)'),
    endDateTime: z.string().describe('Event end (ISO 8601)'),
    location: z.string().optional().describe('Event location'),
    attendees: z.array(z.string().email()).optional().describe('List of attendee emails'),
    timeZone: z.string().optional().default('UTC').describe('Time zone (e.g. Europe/Istanbul)'),
});

export const googleCalendarCreateEvent: ToolDefinition = {
    name: 'google_calendar_create_event',
    description:
        'Create a new event on the user\'s Google Calendar. Requires title, start, and end time. Optionally add description, location, and attendees.',
    parameters: createEventParams,
    async execute(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
        const parsed = createEventParams.parse(params);
        const accessToken = await ensureValidToken(userId, 'google', 'google_calendar_create_event');

        const body = {
            summary: parsed.summary,
            description: parsed.description,
            start: { dateTime: parsed.startDateTime, timeZone: parsed.timeZone },
            end: { dateTime: parsed.endDateTime, timeZone: parsed.timeZone },
            location: parsed.location,
            attendees: parsed.attendees?.map((email) => ({ email })),
        };

        const response = await fetch(
            'https://www.googleapis.com/calendar/v3/calendars/primary/events',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            throw new IntegrationAPIError(
                'google_calendar_create_event',
                'Google Calendar',
                response.status,
                errText
            );
        }

        const created = await response.json() as {
            id: string;
            summary: string;
            htmlLink: string;
            start: { dateTime?: string; date?: string };
            end: { dateTime?: string; date?: string };
        };

        return {
            success: true,
            data: {
                id: created.id,
                title: created.summary,
                link: created.htmlLink,
                start: created.start.dateTime || created.start.date,
                end: created.end.dateTime || created.end.date,
            },
        };
    },
};
