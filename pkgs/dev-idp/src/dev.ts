/**
 * Foreground entrypoint for `bun run --filter @pkgs/dev-idp dev` (and, by
 * extension, the root `bun dev` / `turbo dev` invocation).
 *
 * Boots the standalone dev IdP HTTP server in the foreground so Turbo's
 * persistent-task lifecycle owns it: SIGINT / SIGTERM from `turbo dev`
 * (or Ctrl-C) are translated into a graceful `server.stop(true)` plus
 * `pg.Client.end()` before the process exits.
 *
 * Mirrors the lifecycle invariants of other turbo persistent dev services:
 *   - The server is a direct child of the wrapper; on abnormal wrapper
 *     exit the OS sends SIGHUP to the group and the listener tears down.
 *   - Signal handler is single-flight + idempotent; double Ctrl-C does
 *     not race two shutdowns.
 *   - Boot failures (Postgres unreachable, port in use) log a structured
 *     error and exit 1 so Turbo surfaces the failure instead of hanging.
 */
import { createLogger } from '@pkgs/logger';

import { DEV_IDP_DEFAULT_PORT } from './config';
import type { DevIdpUserCreateInput } from './dev-idp-user-store';
import { startDevIdpServer, type DevIdpServerHandle } from './dev-server';

const log = createLogger({ name: 'dev-idp' });

/**
 * Default fixtures so a fresh `bun dev` always lands the developer on a
 * non-empty account chooser. Stable subs make sign-in deterministic across
 * restarts / Playwright runs.
 */
const DEFAULT_SEED_USERS: readonly DevIdpUserCreateInput[] = [
  {
    sub: '00000000-0000-4000-8000-000000000001',
    email: 'ada@example.com',
    name: 'Ada Lovelace',
    picture: null,
  },
  {
    sub: '00000000-0000-4000-8000-000000000002',
    email: 'alan@example.com',
    name: 'Alan Turing',
    picture: null,
  },
];

let server: DevIdpServerHandle | null = null;
let shutdownPromise: Promise<void> | null = null;

function shutdown(reason: string): Promise<void> {
  if (shutdownPromise !== null) return shutdownPromise;
  shutdownPromise = (async () => {
    log.info('dev-idp: shutting down', { reason });
    if (server !== null) {
      try {
        await server.stop();
      } catch (e) {
        log.error('dev-idp: shutdown failed', {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  })();
  return shutdownPromise;
}

function installSignalHandlers(): void {
  const onSignal = (signal: NodeJS.Signals): void => {
    void shutdown(`signal:${signal}`).then(() => {
      const codes: Record<string, number> = {
        SIGHUP: 129,
        SIGINT: 130,
        SIGQUIT: 131,
        SIGTERM: 143,
      };
      process.exit(codes[signal] ?? 0);
    });
  };
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGQUIT'] as const) {
    process.on(sig, onSignal);
  }
  process.on('uncaughtException', (e) => {
    log.error('dev-idp: uncaughtException', {
      error: e instanceof Error ? e.message : String(e),
    });
    void shutdown('uncaughtException').then(() => process.exit(1));
  });
  process.on('unhandledRejection', (e) => {
    log.error('dev-idp: unhandledRejection', {
      error: e instanceof Error ? e.message : String(e),
    });
    void shutdown('unhandledRejection').then(() => process.exit(1));
  });
}

function readPortFromEnv(): number {
  const raw = process.env['DEV_IDP_PORT']?.trim();
  if (raw === undefined || raw === '') return DEV_IDP_DEFAULT_PORT;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65_535) {
    log.warn('dev-idp: ignoring invalid DEV_IDP_PORT; using default', {
      raw,
      default: DEV_IDP_DEFAULT_PORT,
    });
    return DEV_IDP_DEFAULT_PORT;
  }
  return n;
}

async function main(): Promise<void> {
  installSignalHandlers();
  const port = readPortFromEnv();
  try {
    server = await startDevIdpServer({
      port,
      seedUsers: DEFAULT_SEED_USERS,
      logger: log,
    });
    log.info('dev-idp: ready', { url: server.url });
  } catch (e) {
    log.error('dev-idp: failed to start', {
      error: e instanceof Error ? e.message : String(e),
    });
    await shutdown('boot-failed');
    process.exit(1);
  }
}

await main();
