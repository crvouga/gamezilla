import type { Clock } from '@pkgs/clock-shared/types';
import type { FeedbackRepository } from '@pkgs/feedback-shared/types';
import type { ObjectStore } from '@pkgs/object-store-shared/interface';
import { readBoundedBody } from './bounded-body';
import { MAX_REPORT_BYTES } from './http-handler';
import { normalizeReport } from './normalize-report';
import { resolveReportEvidence } from './resolve-report-evidence';

type Options = {
  reporter: FeedbackRepository;
  store: ObjectStore;
  clock: Clock;
  allowedOrigin: string;
  basePath: string;
};
type RequestContext = {
  request: Request;
  author: string;
  id: string | undefined;
  reply: (body: unknown, status?: number) => Response;
};
export function createFeedbackManagementHandler(options: Options) {
  return async (request: Request): Promise<Response> => {
    const headers = {
      'Access-Control-Allow-Origin': options.allowedOrigin,
      Vary: 'Origin',
      'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Feedback-Author',
      'Cache-Control': 'no-store',
    };
    const reply = (body: unknown, status = 200) =>
      Response.json(body, { status, headers });
    const origin = request.headers.get('Origin');
    if (origin && origin !== options.allowedOrigin)
      return reply({ error: 'Origin refused' }, 403);
    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers });
    const author = request.headers.get('X-Feedback-Author') ?? '';
    const pathname = new URL(request.url).pathname;
    const itemPath = `${options.basePath}/items/`;
    const id = pathname.startsWith(itemPath)
      ? pathname.slice(itemPath.length)
      : undefined;
    if (
      !/^[a-zA-Z0-9-]{1,100}$/.test(author) ||
      (id && !/^[a-zA-Z0-9-]{1,100}$/.test(id))
    )
      return reply({ error: 'Invalid feedback workspace or id' }, 400);
    try {
      return await perform(options, { request, author, id, reply });
    } catch (error) {
      return reply(
        {
          error:
            error instanceof Error
              ? error.message
              : 'Feedback could not be changed',
        },
        503
      );
    }
  };
}
async function perform(
  options: Options,
  context: RequestContext
): Promise<Response> {
  const { request, author, id, reply } = context;
  if (request.method === 'GET')
    return reply(
      id
        ? await options.reporter.read(id, author)
        : await options.reporter.list(author)
    );
  if (!id) return reply({ error: 'Choose feedback' }, 400);
  if (!(await options.reporter.read(id, author)))
    return reply(
      { error: 'Feedback belongs to another developer or is unavailable.' },
      404
    );
  if (request.method === 'DELETE') {
    await options.reporter.remove(id, author);
    return reply({ removed: true });
  }
  if (request.method !== 'PATCH')
    return reply({ error: 'Use GET, PATCH or DELETE' }, 405);
  if (!request.headers.get('Content-Type')?.startsWith('application/json'))
    return reply({ error: 'Use JSON' }, 415);
  const report = normalizeReport(
    JSON.parse(
      new TextDecoder().decode(await readBoundedBody(request, MAX_REPORT_BYTES))
    ),
    options.clock
  );
  if (report.id !== id || report.authorId !== author)
    return reply({ error: 'Feedback does not match its author' }, 400);
  return reply(
    await options.reporter.update(
      await resolveReportEvidence(report, options.store)
    )
  );
}
