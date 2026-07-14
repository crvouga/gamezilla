import { buildDistributedLock } from '../lib/build-distributed-lock';
import { banner, fail, ok, warn } from '../lib/fmt';
import { decodeGithubJobOutputValue } from '../lib/github-job-output-codec';
import type { CiPlatform } from '../platform/platform';
import type { Command } from './types';

/**
 * CI final step (always-runs): releases the global infra lock that
 * `lock-acquire` opened, fenced by `INFRA_LOCK_ID` (passed via
 * `${{ needs.lock-acquire.outputs.lock_id }}` in the workflow).
 *
 * Idempotent — `releaseIfHeldById` is a no-op if the row no longer
 * matches our id (already released, or another run grabbed it). This is
 * the safety net that replaces the inline `Unlock on failure` step.
 *
 * If `INFRA_LOCK_ID` is empty (acquire job never ran or didn't emit the
 * output) we exit 0 — there's nothing to release.
 */
export class LockReleaseCommand implements Command {
  readonly id = 'lock-release';
  readonly group = 'phase' as const;
  readonly summary = 'Release global deploy lock by id (CI only, idempotent)';

  constructor(_platform: CiPlatform) {}

  async execute(): Promise<void> {
    banner('Lock release');

    const lockId = decodeGithubJobOutputValue(
      process.env['INFRA_LOCK_ID'] ?? ''
    );
    if (lockId === '') {
      warn(
        'Global lock',
        'INFRA_LOCK_ID is empty — nothing to release (acquire likely never ran)'
      );
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
    try {
      await lock.releaseIfHeldById(lockId);
      ok('Global lock', `released (id ${lockId})`);
    } finally {
      await disconnect().catch(() => {
        /* best-effort */
      });
    }
  }
}
