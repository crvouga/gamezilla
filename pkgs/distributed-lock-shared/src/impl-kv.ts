import { assert } from '@pkgs/assert-shared/singleton';
import { createAttrNamespace } from '@pkgs/attribute-shared/attribute';
import type { Keyword } from '@pkgs/keyword-shared/keyword';
import { assertNamespacedKeyword } from '@pkgs/keyword-shared/keyword';
import type { Kv, KvRecord } from '@pkgs/kv-shared/interface';
import type {
  DistributedLock,
  LockHandle,
  LockIdentityProvider,
  LockInfo,
} from './interface';
import { LockHeldError } from './interface';

const Lock = createAttrNamespace('lock', 'info');

function parseNonEmptyString(v: unknown): string {
  assert.ok(
    typeof v === 'string' && v.length > 0,
    'LockInfo: non-empty string',
    {
      v,
    }
  );
  return v;
}

function parseString(v: unknown): string {
  assert.ok(typeof v === 'string', 'LockInfo: string', { v });
  return v;
}

function parseFiniteNumber(v: unknown): number {
  assert.ok(typeof v === 'number' && Number.isFinite(v), 'LockInfo: number', {
    v,
  });
  return v;
}

function parseBoolean(v: unknown): boolean {
  assert.ok(typeof v === 'boolean', 'LockInfo: boolean', { v });
  return v;
}

const LockInfoAttr = {
  id: Lock.text('id', parseNonEmptyString),
  operation: Lock.text('operation', parseNonEmptyString),
  holder: Lock.text('holder', parseString),
  pid: Lock.number('pid', parseFiniteNumber),
  ci: Lock.boolean('ci', parseBoolean),
  startedAt: Lock.timestamp('started-at', parseString),
} as const;

function lockInfoFromKvRecord(record: KvRecord): LockInfo {
  return {
    id: LockInfoAttr.id.from(record),
    operation: LockInfoAttr.operation.from(record),
    holder: LockInfoAttr.holder.from(record),
    pid: LockInfoAttr.pid.from(record),
    ci: LockInfoAttr.ci.from(record),
    startedAt: LockInfoAttr.startedAt.from(record),
  };
}

function kvRecordFromLockInfo(info: LockInfo): KvRecord {
  return {
    ...LockInfoAttr.id(info.id),
    ...LockInfoAttr.operation(info.operation),
    ...LockInfoAttr.holder(info.holder),
    ...LockInfoAttr.pid(info.pid),
    ...LockInfoAttr.ci(info.ci),
    ...LockInfoAttr.startedAt(info.startedAt),
  };
}

export interface DistributedLockImplKvOptions {
  /** KV row key; must be a validated namespaced keyword (`prefix/local`). */
  readonly key: Keyword;
  readonly identity: LockIdentityProvider;
  /** Called when release detects the lock was taken over or force-unlocked. */
  readonly onFencingFailure?: (message: string) => void;
}

/**
 * {@link DistributedLock} built on any {@link Kv}. All mutating paths use
 * `kv.transaction` for compare-and-delete fencing on release.
 */
export class DistributedLockImplKv implements DistributedLock {
  private readonly key: Keyword;
  private readonly kv: Kv;
  private readonly identity: LockIdentityProvider;
  private readonly onFencingFailure?: (message: string) => void;

  constructor(kv: Kv, options: DistributedLockImplKvOptions) {
    assertNamespacedKeyword(assert, options.key);
    this.kv = kv;
    this.key = options.key;
    this.identity = options.identity;
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
    return this.kv.tx(async (tx) => {
      const existing = await tx.get(this.key);
      if (existing !== null) {
        throw new LockHeldError(lockInfoFromKvRecord(existing));
      }
      const info = this.identity.build(operation);
      await tx.put(this.key, kvRecordFromLockInfo(info));
      const id = info.id;
      return {
        id,
        release: () => this.releaseFenced(id),
      };
    });
  }

  private async releaseFenced(expectedId: string): Promise<void> {
    await this.kv.tx(async (tx) => {
      const raw = await tx.get(this.key);
      if (raw === null) return;
      let curr: LockInfo;
      try {
        curr = lockInfoFromKvRecord(raw);
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
      return lockInfoFromKvRecord(raw);
    } catch {
      return null;
    }
  }

  async forceUnlock(): Promise<LockInfo | null> {
    return this.kv.tx(async (tx) => {
      const raw = await tx.get(this.key);
      if (raw === null) return null;
      const info = lockInfoFromKvRecord(raw);
      await tx.zap(this.key);
      return info;
    });
  }
}
