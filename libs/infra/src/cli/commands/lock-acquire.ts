import { LockHeldError } from '@pkgs/distributed-lock/interface';
import { buildDistributedLock } from '../lib/build-distributed-lock';
import { cliClock } from '../lib/cli-io';
import { banner, fail, fmtMs, info, kv, ok } from '../lib/fmt';
import { encodeGithubJobOutputValue } from '../lib/github-job-output-codec';
import type { CiPlatform } from '../platform/platform';
import type { Command } from './types';

/**
 * CI step 0: acquires the global infra lock and emits its handle id as
 * `lock_id` for the matching `lock-release` job to fence the delete on.
 *
 * Critically, this command does **not** release the lock on process exit.
 * The lock row stays in Postgres until `lock-release` (or the panic
 * `unlock` command) removes it. We disconnect the SQL session cleanly so
 * Bun doesn't keep the process alive past the lock acquisition.
 *
 * `requiresLock` is false because the auto-acquire-and-release path in
 * `runInfraCommand` would defeat the leak-on-exit semantics this command
 * needs.
 */
export class LockAcquireCommand implements Command {
  readonly id = 'lock-acquire';
  readonly group = 'phase' as const;
  readonly summary = 'Acquire global deploy lock; emits lock_id (CI only)';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    banner('Lock acquire');

    let conn;
    try {
      conn = await buildDistributedLock();
    } catch (e) {
      fail('Global lock', e instanceof Error ? e.message : String(e));
      process.exit(1);
    }

    const { lock, disconnect } = conn;

    try {
      const handle = await lock.acquire('deploy');
      ok('Global lock', `acquired (id ${handle.id})`);
      this.platform.setOutput('lock_id', encodeGithubJobOutputValue(handle.id));
    } catch (e) {
      if (e instanceof LockHeldError) {
        printLockHeld(e);
        process.exit(1);
      }
      throw e;
    } finally {
      // Disconnect the SQL session but leave the lock row in place. The
      // matching `lock-release` job removes it.
      await disconnect().catch(() => {
        /* best-effort */
      });
    }
  }
}

function printLockHeld(e: LockHeldError): void {
  const c = e.current;
  const started = Date.parse(c.startedAt);
  const age = Number.isFinite(started)
    ? fmtMs(cliClock.now() - started)
    : '(unknown)';
  fail('Global lock', `held — ${c.holder} (${c.operation})`);
  kv('holder', c.holder);
  kv('operation', c.operation);
  kv('started', `${age} ago`);
  kv('pid', String(c.pid));
  kv('ci', String(c.ci));
  info(
    'Recovery',
    'wait for the holder to finish, or run `bun run infra unlock` if it is dead'
  );
}
