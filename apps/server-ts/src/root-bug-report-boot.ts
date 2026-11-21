// @io-wall-ok — bug report backend composition root; no product bootstrap

import { createApiObjectStore } from '@libs/app-root-server-ts/object-store';
import { openRequestDb } from '@libs/app-root-server-ts/open-request-db-postgres';
import type { ApiWorkerEnv } from '@libs/app-root-shared-ts/env';
import {
  postgresConnectionString,
  readDeploymentProtection,
  readOptionalDatabaseUrlOverride,
  readSecretsEnvBinding,
  workerEnvToSecretRecord,
} from '@libs/app-root-shared-ts/env';
import type { RequestDb } from '@libs/app-root-shared-ts/open-request-db';
import { ApiSecretName } from '@libs/app-root-shared-ts/secret-names';
import { createApiSecretStore } from '@libs/app-root-shared-ts/secret-store';
import { resolveWebClientOrigin } from '@libs/app-root-shared-ts/web-client-origin';
import type { ExecutionContext } from '@libs/app-root-shared-ts/worker-handler';
import { assertNonProdDatabaseUrl } from '@libs/db-shared-ts/database-url-policy';
import { appPostgresDbScope } from '@libs/db-shared-ts/scope';
import {
  monotonicClock,
  wallClock,
  wallTimers,
} from '@pkgs/clock-shared-ts/wall';
import { createBugReportHttpApp } from '@pkgs/feedback-server-ts/bug-report-http-app';
import type { SecretStore } from '@pkgs/secret-store-shared-ts/interface';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';

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

async function openQueue(
  env: ApiWorkerEnv,
  secretStore: SecretStore
): Promise<RequestDb> {
  const override = readOptionalDatabaseUrlOverride(env);
  const url =
    override !== null && override.length > 0
      ? override
      : (await secretStore.getRequired(ApiSecretName.dbUrl)).readSecretValue();
  if (readDeploymentProtection(env) !== 'production')
    await assertNonProdDatabaseUrl(url, {
      surface: 'bug-reports',
      secretsEnv: readSecretsEnvBinding(env),
    });
  return openRequestDb(postgresConnectionString(env, url), appPostgresDbScope());
}

/**
 * The environment's Postgres, opened on first use: reading back a screenshot
 * never needs it, and a database that cannot be reached is the intake's
 * answer, not a crash.
 */
function lazyQueue(env: ApiWorkerEnv, secretStore: SecretStore) {
  let opened: Promise<RequestDb> | null = null;
  const open = () => {
    opened ??= openQueue(env, secretStore);
    return opened;
  };
  const db: SqlTx = {
    query: async (query) => (await open()).sqlClient.query(query),
    run: async (query) => (await open()).sqlClient.run(query),
  };
  return {
    db,
    async close(): Promise<void> {
      const handle = await opened?.catch(() => null);
      if (handle?.kind === 'postgres') await handle.pool.end();
    },
  };
}

/**
 * Takes a bug report without starting the product, so a product that cannot
 * start can still be reported. It is kept in the environment's bucket and
 * Postgres; the scheduled filing job makes it an issue later.
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
  const secretStore = createApiSecretStore(
    workerEnvToSecretRecord(env),
    wallClock.now
  );
  const queue = lazyQueue(env, secretStore);
  try {
    const store = (
      await createApiObjectStore(secretStore, {
        now: wallClock.now,
        http,
        requireCredentials: true,
      })
    ).withPrefix('bug-reports');
    const origin = new URL(request.url).origin;
    return await createBugReportHttpApp({
      db: queue.db,
      store,
      clock: wallClock,
      allowedOrigins: appOrigins(env, origin),
      onFailure: (error) => console.error('bug report not received', error),
    })(request);
  } catch (error) {
    console.error('bug reports cannot be received', error);
    return Response.json(
      {
        error: 'Bug reports cannot be received right now',
        reason: 'storage is unavailable',
      },
      { status: 503 }
    );
  } finally {
    await queue.close();
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
