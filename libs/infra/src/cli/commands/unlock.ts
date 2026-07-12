import { buildDistributedLock } from '../lib/build-distributed-lock';
import { banner, fail, kv, ok } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import type { Command } from './types';

export class UnlockCommand implements Command {
  readonly id = 'unlock';
  readonly group = 'lifecycle' as const;
  readonly danger = true;
  readonly summary = 'Clear stuck global deploy lock';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    banner('Unlock');
    this.platform.notice('Removing global lock row in Postgres (if held)…');

    let conn;
    try {
      conn = await buildDistributedLock();
    } catch (e) {
      fail('Global lock', e instanceof Error ? e.message : String(e));
      process.exit(1);
    }

    const { lock, disconnect } = conn;
    let prior;
    try {
      prior = await lock.forceUnlock();
    } finally {
      await disconnect();
    }
    if (prior === null) {
      ok('Global lock', 'no lock was held');
      return;
    }

    ok('Global lock', 'released');
    kv('previous holder', prior.holder);
    kv('previous operation', prior.operation);
    kv('previous pid', String(prior.pid));
  }
}
