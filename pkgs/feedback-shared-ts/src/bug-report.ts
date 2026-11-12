import type {
  BugReportSubmission,
  DebugEvent,
  DebugEventKind,
  Diagnostic,
} from './types';

export const MAX_DESCRIPTION_LENGTH = 4000;
export const MAX_SCREENSHOTS = 4;
export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
export const SCREENSHOT_TYPE = /^image\/(png|jpeg|webp)$/;
export const DAILY_BUG_REPORT_LIMIT = 10;

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];

function holds(bytes: Uint8Array, mark: readonly number[], at = 0): boolean {
  return mark.every((byte, index) => bytes[at + index] === byte);
}

/**
 * What kind of picture the bytes are, whatever their sender called them;
 * `null` for anything a bug report does not carry.
 */
export function pictureType(bytes: Uint8Array): string | null {
  if (holds(bytes, PNG)) return 'image/png';
  if (holds(bytes, JPEG)) return 'image/jpeg';
  return holds(bytes, RIFF) && holds(bytes, WEBP, 8) ? 'image/webp' : null;
}
export const BUG_REPORT_ID =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

const MAX_DEBUG_EVENTS = 300;
const MAX_DEBUG_DETAILS = 20;
const EVENT_KINDS: readonly DebugEventKind[] = [
  'navigation',
  'choice',
  'trouble',
  'connection',
];

/** A description is what happened, in the person's words; blank says nothing. */
export function isDescribed(description: string): boolean {
  const length = description.trim().length;
  return length > 0 && length <= MAX_DESCRIPTION_LENGTH;
}

/** The first line names the issue; the whole description stays in its body. */
export function bugReportTitle(description: string): string {
  const line = description.trim().split('\n')[0]?.trim() ?? '';
  return line.length > 80 ? `${line.slice(0, 79)}…` : line;
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('Invalid bug report');
  return value as Record<string, unknown>;
}

function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || value.length > max)
    throw new Error('Invalid bug report text');
  return value;
}

function instant(value: unknown): string {
  const at = text(value, 40);
  if (Number.isNaN(Date.parse(at))) throw new Error('Invalid bug report time');
  return at;
}

function readEvents(value: unknown): readonly DebugEvent[] {
  if (!Array.isArray(value) || value.length > MAX_DEBUG_EVENTS)
    throw new Error('Invalid debug events');
  return value.map((entry: unknown) => {
    const event = record(entry);
    const kind = event['kind'] as DebugEventKind;
    if (!EVENT_KINDS.includes(kind)) throw new Error('Invalid debug event');
    return { at: instant(event['at']), kind, text: text(event['text'], 4000) };
  });
}

function readDetails(value: unknown): readonly Diagnostic[] {
  if (!Array.isArray(value) || value.length > MAX_DEBUG_DETAILS)
    throw new Error('Invalid debug details');
  return value.map((entry: unknown): Diagnostic => {
    const detail = record(entry);
    const name = text(detail['name'], 80);
    return detail['status'] === 'available'
      ? { name, status: 'available', value: detail['value'] ?? null }
      : {
          name,
          status: 'unavailable',
          reason: text(detail['reason'] ?? 'Unavailable', 200),
        };
  });
}

/** The one reader of a bug report that crossed a boundary; anything else is refused. */
export function readBugReportSubmission(value: unknown): BugReportSubmission {
  const input = record(value);
  const id = text(input['id'], 36);
  const reporterId = text(input['reporterId'], 36);
  const description = text(input['description'], MAX_DESCRIPTION_LENGTH * 2);
  if (
    input['schema'] !== 'bug-report/v1' ||
    !BUG_REPORT_ID.test(id) ||
    !BUG_REPORT_ID.test(reporterId) ||
    !isDescribed(description)
  )
    throw new Error('Invalid bug report');
  const debugInfo = record(input['debugInfo']);
  return {
    schema: 'bug-report/v1',
    id,
    reporterId,
    description: description.trim(),
    createdAt: instant(input['createdAt']),
    debugInfo: {
      events: readEvents(debugInfo['events']),
      details: readDetails(debugInfo['details']),
    },
  };
}
