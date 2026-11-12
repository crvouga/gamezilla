// @io-wall-ok — bug report backend composition root; no product bootstrap

import { createApiObjectStore } from '@libs/app-root-server-ts/object-store';
import type { ApiWorkerEnv } from '@libs/app-root-shared-ts/env';
import { workerEnvToSecretRecord } from '@libs/app-root-shared-ts/env';
import { createApiSecretStore } from '@libs/app-root-shared-ts/secret-store';
import { resolveWebClientOrigin } from '@libs/app-root-shared-ts/web-client-origin';
import type { ExecutionContext } from '@libs/app-root-shared-ts/worker-handler';
import {
  monotonicClock,
  wallClock,
  wallTimers,
} from '@pkgs/clock-shared-ts/wall';
import {
  BUG_REPORT_PATH,
  createBugReportHttpApp,
} from '@pkgs/feedback-server-ts/bug-report-http-app';
import { GitHubIssueReporter } from '@pkgs/feedback-server-ts/github-issue-reporter';

class NotConfigured extends Error {}

const CHECK_EVERY_MS = 5 * 60_000;
/** When the issue destination last answered a check, in this Worker's memory. */
let destinationCheckedAt = 0;

type Notes = NonNullable<
  ConstructorParameters<typeof GitHubIssueReporter>[0]['notes']
>;

const SESSION = /^[a-zA-Z0-9_-]{8,64}$/;

/** What this repository's own tools make of a bug report. */
const agentNotes: Notes = (report) => {
  const session = report.debugInfo.details.find(
    (detail) => detail.name === 'session'
  );
  const value =
    session?.status === 'available'
      ? (session.value as { sessionId?: unknown } | null)
      : null;
  const sessionId = value?.sessionId;
  return [
    ...(typeof sessionId === 'string' && SESSION.test(sessionId)
      ? [
          `Telemetry of the same visit: \`bun obs find ${sessionId} --source prod\`.`,
        ]
      : []),
    "To fix it, run `/feedback-implement` with this issue's number.",
  ];
};

/**
 * Every address this environment serves the app from: the ones it declares,
 * else the one its API address implies, and this address when the app and
 * the API are served together.
 */
function appOrigins(env: ApiWorkerEnv, origin: string): readonly string[] {
  const bindings = workerEnvToSecretRecord(env);
  const declared = ['WEB_CLIENT_ORIGIN', 'WEB_CLIENT_APEX_ORIGIN']
    .map((name) => bindings[name]?.trim() ?? '')
    .filter((value) => value.length > 0);
  return [
    ...new Set([
      ...(declared.length > 0
        ? declared
        : [resolveWebClientOrigin(env.API_URL?.trim() || origin)]),
      origin,
    ]),
  ];
}

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
    const apiOrigin = env.FEEDBACK_GITHUB_API_ORIGIN?.trim();
    const origin = new URL(request.url).origin;
    if (!token || !repository) throw new NotConfigured();
    const github = new GitHubIssueReporter({
      token,
      repository,
      http,
      ...(apiOrigin ? { apiOrigin } : {}),
      reportBaseUrl: `${origin}${BUG_REPORT_PATH}/reports`,
      notes: agentNotes,
    });
    return await createBugReportHttpApp({
      store,
      clock: wallClock,
      allowedOrigins: appOrigins(env, origin),
      onFailure: (error) => console.error('bug report not received', error),
      reporter: {
        create: (report) => github.create(report),
        // Anyone may ask; GitHub is asked at most once in a while.
        async check() {
          if (wallClock.now() - destinationCheckedAt < CHECK_EVERY_MS) return;
          await github.check();
          destinationCheckedAt = wallClock.now();
        },
      },
    })(request);
  } catch (error) {
    // Which part is missing is no secret, and it is what the team needs to hear.
    const reason =
      error instanceof NotConfigured
        ? 'FEEDBACK_GITHUB_TOKEN or FEEDBACK_GITHUB_REPOSITORY is not set'
        : 'storage is unavailable';
    console.error('bug reports cannot be received', reason, error);
    return Response.json(
      { error: 'Bug reports cannot be received right now', reason },
      { status: 503 }
    );
  }
}

let recordSend:
  | ((sent: { readonly status: number; readonly durationMs: number }) => void)
  | null = null;

/**
 * One bug report sent from a device, counted for the objectives in
 * `specs/feedback/sending-bug-reports.openslo.yaml`. Counting loads the
 * telemetry only after the answer is ready and never changes it, so a
 * product whose telemetry cannot start still takes bug reports.
 */
export async function countedBugReportSend(
  request: Request,
  env: ApiWorkerEnv,
  ctx: ExecutionContext
): Promise<Response> {
  const started = monotonicClock.now();
  const response = await handleRootBugReport(request, env);
  const durationMs = monotonicClock.now() - started;
  try {
    const [{ ensureWorkerTelemetry }, metrics, { createGlobalHttpClient }] =
      await Promise.all([
        import('./worker-telemetry'),
        import('@pkgs/feedback-server-ts/send-metrics'),
        import('@pkgs/http-client-shared-ts/global'),
      ]);
    const telemetry = ensureWorkerTelemetry(
      env,
      () => crypto.randomUUID(),
      createGlobalHttpClient()
    );
    recordSend ??= metrics.createBugReportSendMetrics();
    recordSend({ status: response.status, durationMs });
    telemetry.flushWith(ctx.waitUntil.bind(ctx));
  } catch (error) {
    console.error('bug report send not counted', error);
  }
  return response;
}
