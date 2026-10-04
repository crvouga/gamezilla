import type { Clock } from '@pkgs/clock-shared/types';
import { readFeedbackReport } from '@pkgs/feedback-shared/read-report';
import type { FeedbackRepository } from '@pkgs/feedback-shared/types';
import { readBytes } from '@pkgs/object-store-root-shared/helpers';
import type { ObjectStore } from '@pkgs/object-store-root-shared/interface';
import { createEvidenceHandler, EVIDENCE_ID } from './evidence-handler';
import { createFeedbackReportHandler, FEEDBACK_PATH } from './http-handler';
import { createFeedbackManagementHandler } from './management-handler';
import { resolveReportEvidence } from './resolve-report-evidence';

export function createFeedbackHttpApp(options: {
  reporter: FeedbackRepository;
  store: ObjectStore;
  clock: Clock;
  allowedOrigin: string;
  basePath?: string;
}) {
  const basePath = feedbackBasePath(options.basePath ?? FEEDBACK_PATH);
  const management = createFeedbackManagementHandler({ ...options, basePath });
  const evidence = createEvidenceHandler(options);
  const report = createFeedbackReportHandler({
    ...options,
    reporter: {
      async create(input) {
        return options.reporter.create(
          await resolveReportEvidence(input, options.store)
        );
      },
    },
  });
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (
      url.pathname === `${basePath}/items` ||
      url.pathname.startsWith(`${basePath}/items/`)
    )
      return management(request);
    if (url.pathname.startsWith(`${basePath}/evidence/`))
      return evidence(request);
    if (
      url.pathname.startsWith(`${basePath}/reports/`) &&
      request.method === 'GET'
    ) {
      const id = url.pathname.split('/').at(-1) ?? '';
      if (!EVIDENCE_ID.test(id))
        return new Response('Invalid report id', { status: 400 });
      const object = await options.store.get(`feedback-${id}/report.json`);
      return object
        ? Response.json(
            readFeedbackReport(
              JSON.parse(new TextDecoder().decode(await readBytes(object.body)))
            ),
            {
              headers: {
                'Cache-Control': 'no-store',
                'X-Content-Type-Options': 'nosniff',
              },
            }
          )
        : new Response('Report unavailable', { status: 404 });
    }
    if (url.pathname !== basePath)
      return new Response('Not found', { status: 404 });
    return report(request);
  };
}

function feedbackBasePath(value: string): string {
  const path = value.length > 1 ? value.replace(/\/$/, '') : value;
  if (!/^\/[a-zA-Z0-9/_-]*[a-zA-Z0-9_-]$/.test(path))
    throw new Error('Invalid feedback base path');
  return path;
}
