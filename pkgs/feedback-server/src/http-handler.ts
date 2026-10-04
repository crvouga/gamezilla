import type { Clock } from '@pkgs/clock-shared/types';
import type { FeedbackReport, IssueReporter } from '@pkgs/feedback-shared/types';

import { readBoundedBody } from './bounded-body';
import { normalizeReport } from './normalize-report';

export const FEEDBACK_PATH = '/api/feedback';
export const MAX_REPORT_BYTES = 1_000_000;

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
      report = normalizeReport(
        JSON.parse(
          new TextDecoder().decode(
            await readBoundedBody(request, MAX_REPORT_BYTES)
          )
        ),
        options.clock
      );
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
