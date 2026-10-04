import * as os from 'node:os';
import type {
  LockIdentityProvider,
  LockInfo,
} from '@pkgs/distributed-lock-shared/interface';
import type { CreateId } from '@pkgs/uuid-shared/create-id';

export type DefaultLockIdentityProviderOptions = {
  readonly now: () => number;
  readonly createId: CreateId;
};

export class DefaultLockIdentityProvider implements LockIdentityProvider {
  private readonly now: () => number;
  private readonly createId: CreateId;

  constructor(options: DefaultLockIdentityProviderOptions) {
    this.now = options.now;
    this.createId = options.createId;
  }

  build(operation: string): LockInfo {
    const id = this.createId();
    const startedAt = new Date(this.now()).toISOString();
    const ci = process.env['GITHUB_ACTIONS'] === 'true';
    const holder = ci ? this.ciHolder() : this.localHolder();
    const pid = typeof process.pid === 'number' ? process.pid : 0;
    return { id, operation, holder, pid, ci, startedAt };
  }

  private ciHolder(): string {
    const repo = process.env['GITHUB_REPOSITORY'] ?? 'unknown';
    const run = process.env['GITHUB_RUN_ID'] ?? '?';
    return `${String(repo)} run ${String(run)}`;
  }

  private localHolder(): string {
    const user = os.userInfo().username;
    const host = os.hostname();
    return `${user}@${host}`;
  }
}
