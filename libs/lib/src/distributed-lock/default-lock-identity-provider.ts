import * as os from 'node:os';
import type { LockInfo } from './interface';
import type { LockIdentityProvider } from './impl-kv';

export class DefaultLockIdentityProvider implements LockIdentityProvider {
  build(operation: string): LockInfo {
    const id = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const ci = process.env['GITHUB_ACTIONS'] === 'true';
    const holder = ci ? this.ciHolder() : this.localHolder();
    const pid = typeof process.pid === 'number' ? process.pid : 0;
    return { id, operation, holder, pid, ci, startedAt };
  }

  private ciHolder(): string {
    const repo = process.env['GITHUB_REPOSITORY'] ?? 'unknown';
    const run = process.env['GITHUB_RUN_ID'] ?? '?';
    return `${repo} run ${run}`;
  }

  private localHolder(): string {
    const user = os.userInfo().username;
    const host = os.hostname();
    return `${user}@${host}`;
  }
}
