import { LockHeldError } from '@gamezilla/shared/global-lock/interface';
import type { Command } from './commands/types';
import { fail, fmtMs, info, kv, warn } from './lib/fmt';
import { buildGlobalLock } from './lib/build-global-lock';
import type { CiPlatform } from './platform/platform';
import { DopplerResource } from './resources/doppler';

/**
 * Runs a command; acquires the global lock when {@link Command.requiresLock} is set.
 * Lock acquisition and release happen here so composed commands (e.g. slaughter-cattle)
 * do not re-enter the lock.
 */
export async function runInfraCommand(
  command: Command,
  _platform: CiPlatform
): Promise<void> {
  if (command.requiresLock !== true) {
    await command.execute();
    return;
  }

  // The lock is backed by PlanetScale Postgres, which needs TF_VAR_planetscale_*
  // and PLANETSCALE_SERVICE_TOKEN* in env. Hydrate from Doppler here so the lock
  // can be acquired before the resource DAG (which also loads secrets) runs.
  new DopplerResource().loadSecretsQuick();

  let conn;
  try {
    conn = await buildGlobalLock();
  } catch (e) {
    fail(
      'Global lock',
      e instanceof Error ? e.message : String(e)
    );
    process.exit(1);
  }

  const { lock, disconnect } = conn;

  let handle: { release: () => Promise<void> } | null = null;
  let released = false;

  const releaseOnce = async (): Promise<void> => {
    if (handle === null || released) return;
    released = true;
    try {
      await handle.release();
    } catch (e) {
      warn(
        'Global lock',
        e instanceof Error ? e.message : String(e)
      );
    }
  };

  const onSignal = (): void => {
    void releaseOnce()
      .then(() => disconnect())
      .finally(() => {
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
    await releaseOnce();
    await disconnect();
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
  }
}

function printLockHeld(e: LockHeldError): void {
  const c = e.current;
  const started = Date.parse(c.startedAt);
  const age =
    Number.isFinite(started) ? fmtMs(Date.now() - started) : '(unknown)';
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
