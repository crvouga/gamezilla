// @io-wall-ok — reporting backend composition root; no product bootstrap
import type { ApiWorkerEnv } from '@libs/server-app/config/env';
import { resolveWebClientOrigin } from '@libs/server-app/config/web-client-origin';
import {
  createFeedbackReportHandler,
  GitHubIssueReporter,
} from '@pkgs/feedback/server';
import { wallClock, wallTimers } from '@pkgs/clock';

export async function handleRootFeedbackReport(
  request: Request,
  env: ApiWorkerEnv
): Promise<Response> {
  const token = env.FEEDBACK_GITHUB_TOKEN?.trim();
  const repository = env.FEEDBACK_GITHUB_REPOSITORY?.trim();
  if (!token || !repository)
    return Response.json(
      { error: 'Bug report destination unavailable' },
      { status: 503 }
    );
  const reporter = new GitHubIssueReporter({
    token,
    repository,
    http: {
      async fetch(input, init) {
        const controller = new AbortController();
        const handle = wallTimers.setTimeout(() => controller.abort(), 8000);
        try {
          return await globalThis.fetch(input, {
            ...init,
            signal: controller.signal,
          });
        } finally {
          wallTimers.clearTimeout(handle);
        }
      },
    },
  });
  return createFeedbackReportHandler({
    reporter,
    clock: wallClock,
    allowedOrigin: resolveWebClientOrigin(
      env.API_URL?.trim() || new URL(request.url).origin
    ),
  })(request);
}
