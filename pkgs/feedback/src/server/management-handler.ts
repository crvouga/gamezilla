import type { Clock } from '@pkgs/clock';
import type { FeedbackRepository } from '../shared/types';
import { readBoundedBody } from './bounded-body';
import { MAX_REPORT_BYTES } from './http-handler';
import { normalizeReport } from './normalize-report';

export function createFeedbackManagementHandler(options: { reporter: FeedbackRepository; clock: Clock; allowedOrigin: string }) {
  return async (request: Request): Promise<Response> => {
    const headers = {
      'Access-Control-Allow-Origin': options.allowedOrigin, Vary: 'Origin',
      'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Feedback-Author', 'Cache-Control': 'no-store',
    };
    const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
    const origin = request.headers.get('Origin');
    if (origin && origin !== options.allowedOrigin) return reply({ error: 'Origin refused' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const author = request.headers.get('X-Feedback-Author') ?? '';
    if (!/^[a-zA-Z0-9-]{1,100}$/.test(author)) return reply({ error: 'Choose your feedback workspace' }, 400);
    const id = new URL(request.url).pathname.split('/').at(4);
    if (id && !/^[a-zA-Z0-9-]{1,100}$/.test(id)) return reply({ error: 'Invalid feedback id' }, 400);
    try {
      if (request.method === 'GET') return reply(id ? await options.reporter.read(id, author) : await options.reporter.list(author));
      if (!id) return reply({ error: 'Choose feedback' }, 400);
      if (!(await options.reporter.read(id, author))) return reply({ error: 'Feedback belongs to another developer or is unavailable.' }, 404);
      if (request.method === 'DELETE') { await options.reporter.remove(id, author); return reply({ removed: true }); }
      if (request.method !== 'PATCH') return reply({ error: 'Use GET, PATCH or DELETE' }, 405);
      if (!request.headers.get('Content-Type')?.startsWith('application/json')) return reply({ error: 'Use JSON' }, 415);
      const bytes = await readBoundedBody(request, MAX_REPORT_BYTES);
      const report = normalizeReport(JSON.parse(new TextDecoder().decode(bytes)), options.clock);
      if (report.id !== id || report.authorId !== author) return reply({ error: 'Feedback does not match its author' }, 400);
      return reply(await options.reporter.update(report));
    } catch (error) {
      return reply({ error: error instanceof Error ? error.message : 'Feedback could not be changed' }, 503);
    }
  };
}
