import * as os from 'node:os';
import { assert } from '../assert';
import type { Kv } from '../kv/interface';
import {
  type DistributedLock,
  type LockHandle,
  type LockInfo,
  LockHeldError,
} from './interface';

export interface LockIdentityProvider {
  build(operation: string): LockInfo;
}

export interface DistributedLockImplKvOptions {
  readonly key: string;
  readonly identity?: LockIdentityProvider;
  /** Called when release detects the lock was taken over or force-unlocked. */
  readonly onFencingFailure?: (message: string) => void;
}

/**
 * {@link DistributedLock} built on any {@link Kv}. All mutating paths use
 * `kv.transaction` for compare-and-delete fencing on release.
 */
export class DistributedLockImplKv implements DistributedLock {
  private readonly key: string;
  private readonly kv: Kv;
  private readonly identity: LockIdentityProvider;
  private readonly onFencingFailure?: (message: string) => void;

  constructor(kv: Kv, options: DistributedLockImplKvOptions) {
    assert.ok(
      typeof options.key === 'string' && options.key.length > 0,
      'DistributedLockImplKv: key must be non-empty',
      { key: options.key }
    );
    this.kv = kv;
    this.key = options.key;
    this.identity = options.identity ?? new DefaultLockIdentityProvider();
    this.onFencingFailure = options.onFencingFailure ?? (() => {});
  }

  async releaseIfHeldById(expectedId: string): Promise<void> {
    assert.ok(
      typeof expectedId === 'string' && expectedId.length > 0,
      'DistributedLockImplKv: expectedId must be non-empty',
      { expectedId }
    );
    return this.releaseFenced(expectedId);
  }

  async acquire(operation: string): Promise<LockHandle> {
    assert.ok(
      typeof operation === 'string' && operation.length > 0,
      'DistributedLockImplKv: operation must be non-empty',
      { operation }
    );
    return this.kv.transaction(async (tx) => {
      const existing = await tx.get(this.key);
      if (existing !== null) {
        throw new LockHeldError(parseLockInfo(existing));
      }
      const info = this.identity.build(operation);
      await tx.put(this.key, JSON.stringify(info));
      const id = info.id;
      return {
        id,
        release: () => this.releaseFenced(id),
      };
    });
  }

  private async releaseFenced(expectedId: string): Promise<void> {
    await this.kv.transaction(async (tx) => {
      const raw = await tx.get(this.key);
      if (raw === null) return;
      let curr: LockInfo;
      try {
        curr = parseLockInfo(raw);
      } catch {
        this.onFencingFailure?.(
          'DistributedLock: stored value is not valid LockInfo'
        );
        return;
      }
      if (curr.id !== expectedId) {
        this.onFencingFailure?.(
          'DistributedLock: release fencing failed — lock was force-unlocked or taken over'
        );
        return;
      }
      await tx.zap(this.key);
    });
  }

  async status(): Promise<LockInfo | null> {
    const raw = await this.kv.get(this.key);
    if (raw === null) return null;
    try {
      return parseLockInfo(raw);
    } catch {
      return null;
    }
  }

  async forceUnlock(): Promise<LockInfo | null> {
    return this.kv.transaction(async (tx) => {
      const raw = await tx.get(this.key);
      if (raw === null) return null;
      const info = parseLockInfo(raw);
      await tx.zap(this.key);
      return info;
    });
  }
}

class DefaultLockIdentityProvider implements LockIdentityProvider {
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

function parseLockInfo(raw: string): LockInfo {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    assert.fail('LockInfo JSON parse failed', { raw: raw.slice(0, 200) });
  }
  assert.ok(
    parsed !== null && typeof parsed === 'object',
    'LockInfo must be object',
    { parsed }
  );
  const o = parsed as Record<string, unknown>;
  assert.ok(typeof o['id'] === 'string' && o['id'].length > 0, 'LockInfo.id');
  assert.ok(
    typeof o['operation'] === 'string' && o['operation'].length > 0,
    'LockInfo.operation'
  );
  assert.ok(typeof o['holder'] === 'string', 'LockInfo.holder');
  assert.ok(typeof o['pid'] === 'number', 'LockInfo.pid');
  assert.ok(typeof o['ci'] === 'boolean', 'LockInfo.ci');
  assert.ok(typeof o['startedAt'] === 'string', 'LockInfo.startedAt');
  return {
    id: o['id'],
    operation: o['operation'],
    holder: o['holder'],
    pid: o['pid'],
    ci: o['ci'],
    startedAt: o['startedAt'],
  };
}
