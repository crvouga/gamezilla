// @io-wall-ok — bug report backend composition root; no product bootstrap

import { createApiObjectStore } from '@libs/app-root-server-ts/object-store';
import type { ApiWorkerEnv } from '@libs/app-root-shared-ts/env';
import { workerEnvToSecretRecord } from '@libs/app-root-shared-ts/env';
import { createApiSecretStore } from '@libs/app-root-shared-ts/secret-store';
import { resolveWebClientOrigin } from '@libs/app-root-shared-ts/web-client-origin';
import { wallClock, wallTimers } from '@pkgs/clock-shared-ts/wall';
import {
  BUG_REPORT_PATH,
  createBugReportHttpApp,
} from '@pkgs/feedback-server-ts/bug-report-http-app';
import { GitHubIssueReporter } from '@pkgs/feedback-server-ts/github-issue-reporter';

/**
 * Takes a bug report without starting the product, so a product that cannot
 * start can still be reported.
 */
export async function handleRootBugReport(
  request: Request,
  env: ApiWorkerEnv
): Promise<Response> {
  const http = {
    async fetch(input: RequestInfo | URL, init?: RequestInit) {
      const controller = new AbortController();
      const handle = wallTimers.setTimeout(() => controller.abort(), 8000);
      const abort = () => controller.abort();
      init?.signal?.addEventListener('abort', abort, { once: true });
      try {
        return await globalThis.fetch(input, {
          ...init,
          signal: controller.signal,
        });
      } finally {
        wallTimers.clearTimeout(handle);
        init?.signal?.removeEventListener('abort', abort);
      }
    },
  };
  try {
    const secretStore = createApiSecretStore(
      workerEnvToSecretRecord(env),
      wallClock.now
    );
    const store = (
      await createApiObjectStore(secretStore, {
        now: wallClock.now,
        http,
        requireCredentials: true,
      })
    ).withPrefix('bug-reports');
    const token = env.FEEDBACK_GITHUB_TOKEN?.trim();
    const repository = env.FEEDBACK_GITHUB_REPOSITORY?.trim();
    const origin = new URL(request.url).origin;
    if (!token || !repository)
      throw new Error('GitHub bug report destination is not configured');
    return await createBugReportHttpApp({
      store,
      clock: wallClock,
      allowedOrigin: resolveWebClientOrigin(env.API_URL?.trim() || origin),
      reporter: new GitHubIssueReporter({
        token,
        repository,
        http,
        reportBaseUrl: `${origin}${BUG_REPORT_PATH}/reports`,
      }),
    })(request);
  } catch {
    return Response.json(
      { error: 'Bug reports cannot be received right now' },
      { status: 503 }
    );
  }
}
