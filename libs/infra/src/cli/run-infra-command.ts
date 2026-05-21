import type { LockHandle } from '@gamezilla/distributed-lock/interface';
import { LockHeldError } from '@gamezilla/distributed-lock/interface';
import type { Command } from './commands/types';
import { buildDistributedLock } from './lib/build-distributed-lock';
import { fail, fmtMs, info, kv, ok, warn } from './lib/fmt';
import type { CiPlatform } from './platform/platform';
import { DopplerResource } from './resources/doppler';

/**
 * Hard upper bound on a single lock-release/disconnect attempt. Sized to
 * fit inside GitHub Actions' ~7.5s SIGTERM-to-SIGKILL grace window so the
 * happy-path in-process release can win the cleanup race on cancelled /
 * timed-out steps. The always-run `lock-release` job in
 * `.github/workflows/deployment-pipeline.yml` is the safety net for
 * everything that doesn't fit (full SIGKILL, runner death, OOM).
 */
const RELEASE_TIMEOUT_MS = 5_000;

/**
 * Signals we translate into a graceful release-and-exit. SIGKILL / SIGSTOP
 * cannot be trapped — nothing we can do there; `unlock` is the recovery path.
 */
const EXIT_SIGNALS = [
  'SIGINT',
  'SIGTERM',
  'SIGHUP',
  'SIGQUIT',
  'SIGBREAK',
] as const;

/**
 * Runs a command; acquires the global lock when {@link Command.requiresLock} is set.
 *
 * Release correctness matters more than error fidelity: any path that exits
 * this function — `command.execute()` resolving, throwing, `uncaughtException`,
 * `unhandledRejection`, or a termination signal — MUST release the lock before
 * the process goes away. Anything else leaves the next `deploy` wedged until a
 * human runs `bun run infra unlock`.
 */
export async function runInfraCommand(
  command: Command,
  platform: CiPlatform
): Promise<void> {
  // Hydrate Doppler secrets into env for every command except `setup` itself
  // (setup is what installs Doppler and seeds these secrets in the first place).
  // This removes the requirement to run `setup` before commands like `unlock`,
  // `status`, `destroy`, etc., which need Doppler-backed env (e.g.
  // PLANETSCALE_SERVICE_TOKEN*, DB_URL) where applicable.
  if (command.id !== 'setup' && command.id !== 'pipeline-report') {
    new DopplerResource().loadSecretsQuick();
  }

  if (command.requiresLock !== true) {
    await command.execute();
    return;
  }

  let conn;
  try {
    conn = await buildDistributedLock();
  } catch (e) {
    fail('Global lock', e instanceof Error ? e.message : String(e));
    process.exit(1);
  }

  const { lock, disconnect } = conn;

  let handle: LockHandle | null = null;

  /** Single-flight release + disconnect. Never throws; always resolves. */
  let shutdownPromise: Promise<void> | null = null;
  const shutdownLockAndDisconnect = (): Promise<void> => {
    shutdownPromise ??= (async () => {
      await withTimeout(
        releaseLock(),
        RELEASE_TIMEOUT_MS,
        'lock release timed out'
      ).catch((e) => {
        warn('Global lock', describe(e));
      });
      await withTimeout(
        safeDisconnect(disconnect),
        RELEASE_TIMEOUT_MS,
        'lock disconnect timed out'
      ).catch((e) => {
        warn('Global lock', describe(e));
      });
    })();
    return shutdownPromise;
  };

  async function releaseLock(): Promise<void> {
    if (handle === null) return;
    const lockId = handle.id;
    try {
      await handle.release();
      ok('Global lock', 'released');
      return;
    } catch (e) {
      warn('Global lock', `primary release failed: ${describe(e)}`);
    }
    // Fallback: the original DB connection may have died mid-deploy. Open a
    // fresh connection and fence by id so we only delete the row we own.
    try {
      const conn2 = await buildDistributedLock();
      try {
        await conn2.lock.releaseIfHeldById(lockId);
        ok('Global lock', 'released (recovery connection)');
      } finally {
        await safeDisconnect(conn2.disconnect);
      }
    } catch (e) {
      fail(
        'Global lock',
        `recovery release failed: ${describe(e)} — run \`bun run infra unlock\``
      );
    }
  }

  // Fatal-path handlers. These MUST release the lock before the process dies.
  // We flag ourselves as handled so we still exit non-zero after cleanup.
  const onFatal = (reason: unknown, source: string): void => {
    fail('Global lock', `${source}: ${describe(reason)}`);
    void shutdownLockAndDisconnect().finally(() => {
      process.exit(1);
    });
  };
  const onUncaught = (e: unknown): void => onFatal(e, 'uncaughtException');
  const onUnhandled = (e: unknown): void => onFatal(e, 'unhandledRejection');
  const onSignal = (signal: NodeJS.Signals): void => {
    info('Global lock', `received ${signal}, releasing…`);
    void shutdownLockAndDisconnect().finally(() => {
      // Conventional 128 + signal exit code; default to SIGINT's 130 if unknown.
      process.exit(signalExitCode(signal));
    });
  };
  const signalHandlers: Array<
    readonly [NodeJS.Signals, (s: NodeJS.Signals) => void]
  > = EXIT_SIGNALS.map((sig) => [sig, onSignal] as const);

  process.on('uncaughtException', onUncaught);
  process.on('unhandledRejection', onUnhandled);
  for (const [sig, h] of signalHandlers) process.once(sig, h);

  const removeAllHandlers = (): void => {
    process.removeListener('uncaughtException', onUncaught);
    process.removeListener('unhandledRejection', onUnhandled);
    for (const [sig, h] of signalHandlers) process.removeListener(sig, h);
  };

  try {
    try {
      handle = await lock.acquire(command.id);
    } catch (e) {
      if (e instanceof LockHeldError) {
        printLockHeld(e);
        await safeDisconnect(disconnect);
        removeAllHandlers();
        process.exit(1);
      }
      throw e;
    }

    // Emit `lock_id` to GITHUB_OUTPUT immediately so the workflow's
    // always-run `lock-release` job has a fence id available even if a
    // later phase crashes hard enough to skip the in-process cleanup
    // path (OOM, runner termination).
    platform.setOutput('lock_id', handle.id);

    await command.execute();
  } finally {
    await shutdownLockAndDisconnect();
    removeAllHandlers();
  }
}

function describe(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(label)), ms);
    // Don't keep the event loop alive for this watchdog.
    if (typeof timer.unref === 'function') timer.unref();
  });
  return Promise.race([p, timeout]).finally(() => {
    if (timer !== null) clearTimeout(timer);
  });
}

async function safeDisconnect(disconnect: () => Promise<void>): Promise<void> {
  try {
    await disconnect();
  } catch (e) {
    warn('Global lock', `disconnect failed: ${describe(e)}`);
  }
}

function signalExitCode(signal: NodeJS.Signals): number {
  const map: Record<string, number> = {
    SIGHUP: 129,
    SIGINT: 130,
    SIGQUIT: 131,
    SIGTERM: 143,
    SIGBREAK: 149,
  };
  return map[signal] ?? 1;
}

function printLockHeld(e: LockHeldError): void {
  const c = e.current;
  const started = Date.parse(c.startedAt);
  const age = Number.isFinite(started)
    ? fmtMs(Date.now() - started)
    : '(unknown)';
  fail('Global lock', `held — ${c.holder} (${c.operation})`);
  kv('holder', c.holder);
  kv('operation', c.operation);
  kv('started', `${age} ago`);
  kv('pid', String(c.pid));
  kv('ci', String(c.ci));
  info(
    'Recovery',
    'if the holder crashed or was killed, run `bun run infra unlock`'
  );
}
