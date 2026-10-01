import type { Clock } from '@pkgs/clock';
import type { FeedbackReport, Diagnostic, IssueReporter } from '../shared/types';

export const FEEDBACK_PATH = '/api/feedback';
export const MAX_REPORT_BYTES = 256_000;

async function readBody(request: Request): Promise<unknown> {
  if (request.body === null) throw new Error('Missing body');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value === undefined) continue;
      size += value.byteLength;
      if (size > MAX_REPORT_BYTES) throw new Error('Report too large');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

function diagnostics(value: unknown): readonly Diagnostic[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).flatMap<Diagnostic>((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const d = entry as Record<string, unknown>;
    if (typeof d['name'] !== 'string') return [];
    const name = d['name'].slice(0, 80);
    if (d['status'] === 'available')
      return [
        { name, status: 'available' as const, value: d['value'] ?? null },
      ];
    return [{ name, status: 'unavailable' as const, reason: 'Unavailable' }];
  });
}

function normalize(body: unknown, clock: Clock): FeedbackReport {
  if (typeof body !== 'object' || body === null)
    throw new Error('Invalid report');
  const input = body as Record<string, unknown>;
  if (
    typeof input['id'] !== 'string' ||
    !/^[a-zA-Z0-9-]{1,100}$/.test(input['id'])
  )
    throw new Error('Invalid report id');
  if (
    typeof input['title'] !== 'string' ||
    typeof input['description'] !== 'string'
  )
    throw new Error('Invalid report text');
  let createdAt = 'unknown';
  try {
    createdAt = new Date(clock.now()).toISOString();
  } catch {
    /* emergency report */
  }
  return {
    version: 1,
    id: input['id'],
    title: input['title'].trim().slice(0, 240) || 'Emergency feedback report',
    description: input['description'].slice(0, 32_000),
    createdAt,
    status: 'open',
    diagnostics: diagnostics(input['diagnostics']),
  };
}

export function createFeedbackReportHandler(options: {
  readonly reporter: IssueReporter;
  readonly clock: Clock;
  readonly allowedOrigin: string;
}) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('Origin');
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': options.allowedOrigin,
      Vary: 'Origin',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (origin !== null && origin !== options.allowedOrigin)
      return Response.json(
        { error: 'Origin refused' },
        { status: 403, headers }
      );
    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers });
    if (request.method !== 'POST')
      return Response.json({ error: 'Use POST' }, { status: 405, headers });
    if (!request.headers.get('Content-Type')?.startsWith('application/json'))
      return Response.json({ error: 'Use JSON' }, { status: 415, headers });
    let report: FeedbackReport;
    try {
      report = normalize(await readBody(request), options.clock);
    } catch {
      return Response.json(
        { error: 'Invalid or oversized report' },
        { status: 400, headers }
      );
    }
    try {
      const issue = await options.reporter.create(report);
      return Response.json(issue, { status: 201, headers });
    } catch {
      return Response.json(
        { error: 'Could not save report; keep your emergency copy' },
        { status: 503, headers }
      );
    }
  };
}
