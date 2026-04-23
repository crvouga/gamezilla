import type { LockHandle } from '@gamezilla/shared/distributed-lock/interface';
import { LockHeldError } from '@gamezilla/shared/distributed-lock/interface';
import type { Command } from './commands/types';
import { buildDistributedLock } from './lib/build-distributed-lock';
import { fail, fmtMs, info, kv, warn } from './lib/fmt';
import type { CiPlatform } from './platform/platform';
import { DopplerResource } from './resources/doppler';

/**
 * Runs a command; acquires the global lock when {@link Command.requiresLock} is set.
 * Lock acquisition and release happen here so any composed commands invoked
 * programmatically (bypassing the CLI entry) do not re-enter the lock.
 */
export async function runInfraCommand(
  command: Command,
  _platform: CiPlatform
): Promise<void> {
  // Hydrate Doppler secrets into env for every command except `setup` itself
  // (setup is what installs Doppler and seeds these secrets in the first place).
  // This removes the requirement to run `setup` before commands like `unlock`,
  // `status`, `destroy`, etc., which all need TF_VAR_planetscale_* and
  // PLANETSCALE_SERVICE_TOKEN* to talk to PlanetScale.
  if (command.id !== 'setup') {
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

  /** Single-flight: primary release, then recovery on a fresh DB connection if needed. */
  let shutdownPromise: Promise<void> | null = null;
  const shutdownLockAndDisconnect = (): Promise<void> => {
    shutdownPromise ??= (async () => {
      if (handle === null) {
        await disconnect();
        return;
      }
      const lockId = handle.id;
      let primaryOk = false;
      try {
        await handle.release();
        primaryOk = true;
      } catch (e) {
        warn('Global lock', e instanceof Error ? e.message : String(e));
      }
      if (!primaryOk) {
        try {
          const conn2 = await buildDistributedLock();
          try {
            await conn2.lock.releaseIfHeldById(lockId);
          } finally {
            await conn2.disconnect();
          }
        } catch (e2) {
          warn(
            'Global lock',
            `lock recovery release failed: ${e2 instanceof Error ? e2.message : String(e2)}`
          );
        }
      }
      await disconnect();
    })();
    return shutdownPromise;
  };

  const onSignal = (): void => {
    void shutdownLockAndDisconnect().finally(() => {
      process.exit(130);
    });
  };

  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);

  try {
    try {
      handle = await lock.acquire(command.id);
    } catch (e) {
      if (e instanceof LockHeldError) {
        printLockHeld(e);
        await disconnect();
        process.exit(1);
      }
      throw e;
    }

    await command.execute();
  } finally {
    await shutdownLockAndDisconnect();
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
  }
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
