// @io-wall-ok — feedback backend composition root; no product bootstrap
import type { ApiWorkerEnv } from '@libs/server-app/config/env';
import { workerEnvToSecretRecord } from '@libs/server-app/config/env';
import { createApiObjectStore } from '@libs/server-app/config/object-store';
import { createApiSecretStore } from '@libs/server-app/config/secret-store';
import { resolveWebClientOrigin } from '@libs/server-app/config/web-client-origin';
import { wallClock, wallTimers } from '@pkgs/clock';
import {
  ArchivedIssueReporter,
  createFeedbackHttpApp,
  FileSystemIssueReporter,
  GitHubIssueReporter,
} from '@pkgs/feedback/server';

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
    const archive = new FileSystemIssueReporter(store);
    const token = env.FEEDBACK_GITHUB_TOKEN?.trim();
    const repository = env.FEEDBACK_GITHUB_REPOSITORY?.trim();
    const origin = new URL(request.url).origin;
    const github =
      token && repository
        ? new GitHubIssueReporter({
            token,
            repository,
            http,
            reportBaseUrl: `${origin}/api/feedback/reports`,
          })
        : null;
    return await createFeedbackHttpApp({
      store,
      clock: wallClock,
      allowedOrigin: resolveWebClientOrigin(env.API_URL?.trim() || origin),
      reporter: github ? new ArchivedIssueReporter(store, github) : archive,

    })(request);
  } catch {
    return Response.json(
      { error: 'Feedback storage unavailable; keep your emergency copy' },
      { status: 503 }
    );
  }
}
