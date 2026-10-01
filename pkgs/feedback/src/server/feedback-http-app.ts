import type { Clock } from '@pkgs/clock';
import type { ObjectStore } from '@pkgs/object-store/interface';
import type { FeedbackRepository } from '../shared/types';
import { createEvidenceHandler, EVIDENCE_ID } from './evidence-handler';
import { createFeedbackReportHandler, FEEDBACK_PATH } from './http-handler';
import { createFeedbackManagementHandler } from './management-handler';
import { resolveReportEvidence } from './resolve-report-evidence';

export function createFeedbackHttpApp(options: {
  reporter: FeedbackRepository;
  store: ObjectStore;
  clock: Clock;
  allowedOrigin: string;
}) {
  const management = createFeedbackManagementHandler(options);
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
      url.pathname === `${FEEDBACK_PATH}/items` ||
      url.pathname.startsWith(`${FEEDBACK_PATH}/items/`)
    )
      return management(request);
    if (url.pathname.startsWith(`${FEEDBACK_PATH}/evidence/`))
      return evidence(request);
    if (
      url.pathname.startsWith(`${FEEDBACK_PATH}/reports/`) &&
      request.method === 'GET'
    ) {
      const id = url.pathname.split('/').at(-1) ?? '';
      if (!EVIDENCE_ID.test(id))
        return new Response('Invalid report id', { status: 400 });
      const object = await options.store.get(`feedback-${id}/report.json`);
      return object
        ? new Response(object.body, {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store',
              'X-Content-Type-Options': 'nosniff',
            },
          })
        : new Response('Report unavailable', { status: 404 });
    }
    if (url.pathname !== FEEDBACK_PATH)
      return new Response('Not found', { status: 404 });
    return report(request);
  };
}
