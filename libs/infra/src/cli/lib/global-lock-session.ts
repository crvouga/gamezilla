import type { LockHandle } from '@pkgs/distributed-lock/interface';
import { LockHeldError } from '@pkgs/distributed-lock/interface';
import type { CiPlatform } from '../platform/platform';
import { buildDistributedLock } from './build-distributed-lock';
import { cliIo } from './cli-io';
import { fail, fmtMs, info, kv, ok, warn } from './fmt';
import { encodeGithubJobOutputValue } from './github-job-output-codec';
import { registerLockDbSessionHooks } from './lock-db-session';

const RELEASE_TIMEOUT_MS = 5_000;

const EXIT_SIGNALS = [
  'SIGINT',
  'SIGTERM',
  'SIGHUP',
  'SIGQUIT',
  'SIGBREAK',
] as const;

/**
 * Acquires the Postgres-backed global lock, runs `fn`, then releases.
 * Registers lock DB suspend hooks for subprocess phases (stripe-sync, etc.).
 */
export async function runWithGlobalLock<T>(
  platform: CiPlatform,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  let conn;
  try {
    conn = await buildDistributedLock();
  } catch (e) {
    fail('Global lock', e instanceof Error ? e.message : String(e));
    process.exit(1);
  }

  let activeLock = conn.lock;
  let activeDisconnect = conn.disconnect;

  registerLockDbSessionHooks({
    suspend: () => safeDisconnect(activeDisconnect),
    resume: async () => {
      const next = await buildDistributedLock();
      activeLock = next.lock;
      activeDisconnect = next.disconnect;
    },
  });

  let handle: LockHandle | null = null;
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
        safeDisconnect(activeDisconnect),
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
      await activeLock.releaseIfHeldById(lockId);
      ok('Global lock', 'released');
      return;
    } catch (e) {
      warn('Global lock', `primary release failed: ${describe(e)}`);
    }
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
      handle = await activeLock.acquire(operation);
    } catch (e) {
      if (e instanceof LockHeldError) {
        printLockHeld(e);
        await safeDisconnect(activeDisconnect);
        removeAllHandlers();
        registerLockDbSessionHooks(null);
        process.exit(1);
      }
      throw e;
    }

    // Hex-encode so secret-masked secret substrings (e.g. CF account id
    // hex overlapping a UUID) do not cause GHA to drop the job output.
    platform.setOutput('lock_id', encodeGithubJobOutputValue(handle.id));

    return await fn();
  } finally {
    await shutdownLockAndDisconnect();
    removeAllHandlers();
    registerLockDbSessionHooks(null);
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
  let timer: unknown = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = cliIo.timers.setTimeout(() => reject(new Error(label)), ms);
    if (
      timer !== null &&
      typeof timer === 'object' &&
      'unref' in timer &&
      typeof timer.unref === 'function'
    ) {
      timer.unref();
    }
  });
  return Promise.race([p, timeout]).finally(() => {
    if (timer !== null) cliIo.timers.clearTimeout(timer);
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
    ? fmtMs(cliIo.clock.now() - started)
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
