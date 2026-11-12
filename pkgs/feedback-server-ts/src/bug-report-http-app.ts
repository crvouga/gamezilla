import type { Clock } from '@pkgs/clock-shared-ts/types';
import {
  BUG_REPORT_ID,
  MAX_SCREENSHOT_BYTES,
  MAX_SCREENSHOTS,
} from '@pkgs/feedback-shared-ts/bug-report';
import type { BugReportStore } from '@pkgs/feedback-shared-ts/types';
import { readBoundedBody } from './bounded-body';
import { createBugReportIntake } from './bug-report-intake';

export const BUG_REPORT_PATH = '/api/bug-reports';
export const MAX_REQUEST_BYTES =
  MAX_SCREENSHOTS * MAX_SCREENSHOT_BYTES + 1_000_000;

type Options = {
  /** Where received reports are recorded and their files kept. */
  readonly store: BugReportStore;
  readonly clock: Clock;
  /** Every address the app itself is served from; no other page may send. */
  readonly allowedOrigins: readonly string[];
  readonly basePath?: string;
  readonly onFailure?: (error: unknown) => void;
};

function validBasePath(value: string): string {
  const path = value.length > 1 ? value.replace(/\/$/, '') : value;
  if (!/^\/[a-zA-Z0-9/_-]*[a-zA-Z0-9_-]$/.test(path))
    throw new Error('Invalid bug report base path');
  return path;
}

async function readForm(request: Request): Promise<FormData | null> {
  const contentType = request.headers.get('Content-Type') ?? '';
  if (!contentType.startsWith('multipart/form-data')) return null;
  try {
    const bytes = await readBoundedBody(request, MAX_REQUEST_BYTES);
    return await new Response(new Blob([bytes as Uint8Array<ArrayBuffer>]), {
      headers: { 'Content-Type': contentType },
    }).formData();
  } catch {
    return null;
  }
}

/** Reads back an archived report or one of its pictures by unlisted address. */
async function readArchive(
  store: BugReportStore,
  path: string,
  headers: Record<string, string>
): Promise<Response> {
  const [id = '', kind, index] = path.split('/');
  const name = kind === undefined ? 'report.json' : `screenshots/${index}`;
  const known =
    BUG_REPORT_ID.test(id) &&
    (kind === undefined ||
      (kind === 'screenshots' && /^[1-9]$/.test(index ?? '')));
  const object = known ? await store.attachments.get(id, name) : null;
  if (!object) return new Response('Not found', { status: 404, headers });
  return new Response(object.body, {
    headers: {
      ...headers,
      'Content-Type': object.contentType,
      'Content-Length': String(object.size),
    },
  });
}

/** Whether the page asking is the app, and the one address the answer is for. */
function admit(
  origin: string | null,
  allowedOrigins: readonly string[]
): { readonly allowed: boolean; readonly answerTo: string } {
  const fallback = allowedOrigins[0] ?? 'null';
  if (origin === null) return { allowed: true, answerTo: fallback };
  return allowedOrigins.includes(origin)
    ? { allowed: true, answerTo: origin }
    : { allowed: false, answerTo: fallback };
}

/** One part a received report needs, and what the team is told when it fails. */
async function ready(
  options: Options,
  part: () => Promise<void>,
  reason: string
): Promise<string | null> {
  try {
    await part();
    return null;
  } catch (error) {
    options.onFailure?.(error);
    return reason;
  }
}

/** Whether a bug report sent now would be recorded, without sending one. */
async function health(
  options: Options,
  headers: Record<string, string>
): Promise<Response> {
  const { records, attachments } = options.store;
  const reasons = (
    await Promise.all([
      ready(options, () => records.check(), 'the issue destination refused'),
      ready(
        options,
        () => attachments.check(),
        'the attachment store is unreachable'
      ),
    ])
  ).filter((reason) => reason !== null);
  if (reasons.length === 0)
    return Response.json({ receiving: true }, { headers });
  return Response.json(
    { receiving: false, reason: reasons.join('; ') },
    { status: 503, headers }
  );
}

/**
 * The whole backend of bug reporting: one address takes a report with its
 * pictures, and the archive under it serves them back to whoever holds the
 * issue. It needs no sign-in, so a person whose sign-in is broken can report.
 * `/health` under it answers once everything a report needs is in place.
 */
export function createBugReportHttpApp(options: Options) {
  const basePath = validBasePath(options.basePath ?? BUG_REPORT_PATH);
  const intakes = new Map<string, ReturnType<typeof createBugReportIntake>>();
  const intakeFor = (origin: string) => {
    const existing = intakes.get(origin);
    if (existing) return existing;
    const created = createBugReportIntake({
      ...options,
      reportsUrl: `${origin}${basePath}/reports`,
    });
    intakes.set(origin, created);
    return created;
  };
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const { allowed, answerTo } = admit(
      request.headers.get('Origin'),
      options.allowedOrigins
    );
    const headers = {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': answerTo,
      Vary: 'Origin',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    if (url.pathname === `${basePath}/health`) return health(options, headers);
    if (url.pathname.startsWith(`${basePath}/reports/`))
      return request.method === 'GET'
        ? readArchive(
            options.store,
            url.pathname.slice(`${basePath}/reports/`.length),
            headers
          )
        : Response.json({ error: 'Use GET' }, { status: 405, headers });
    if (url.pathname !== basePath)
      return Response.json({ error: 'Not found' }, { status: 404, headers });
    if (!allowed)
      return Response.json(
        { error: 'Origin refused' },
        { status: 403, headers }
      );
    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers });
    if (request.method !== 'POST')
      return Response.json({ error: 'Use POST' }, { status: 405, headers });
    const form = await readForm(request);
    if (!form)
      return Response.json(
        { error: 'Invalid or oversized bug report' },
        { status: 400, headers }
      );
    const outcome = await intakeFor(url.origin)(form);
    return Response.json(outcome, { status: outcome.status, headers });
  };
}
