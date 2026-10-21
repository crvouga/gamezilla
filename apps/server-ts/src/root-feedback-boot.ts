// @io-wall-ok — feedback backend composition root; no product bootstrap

import { createApiObjectStore } from '@libs/app-root-server-ts/object-store';
import type { ApiWorkerEnv } from '@libs/app-root-shared-ts/env';
import { workerEnvToSecretRecord } from '@libs/app-root-shared-ts/env';
import { createApiSecretStore } from '@libs/app-root-shared-ts/secret-store';
import { resolveWebClientOrigin } from '@libs/app-root-shared-ts/web-client-origin';
import { wallClock, wallTimers } from '@pkgs/clock-shared-ts/wall';
import { ArchivedIssueReporter } from '@pkgs/feedback-server-ts/archived-issue-reporter';
import { createFeedbackHttpApp } from '@pkgs/feedback-server-ts/feedback-http-app';
import { GitHubIssueReporter } from '@pkgs/feedback-server-ts/github-issue-reporter';

export async function handleRootFeedbackReport(
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
    ).withPrefix('feedback');
    const token = env.FEEDBACK_GITHUB_TOKEN?.trim();
    const repository = env.FEEDBACK_GITHUB_REPOSITORY?.trim();
    const origin = new URL(request.url).origin;
    if (!token || !repository)
      throw new Error('GitHub feedback destination is not configured');
    const github = new GitHubIssueReporter({
      token,
      repository,
      http,
      reportBaseUrl: `${origin}/api/feedback/reports`,
    });
    return await createFeedbackHttpApp({
      store,
      clock: wallClock,
      allowedOrigin: resolveWebClientOrigin(env.API_URL?.trim() || origin),
      reporter: new ArchivedIssueReporter(store, github),
    })(request);
  } catch {
    return Response.json(
      { error: 'Feedback storage unavailable; keep your emergency copy' },
      { status: 503 }
    );
  }
}
