import { assert } from '../assert';
import type {
  CompareVersions,
  Entity,
  EntityDb,
  EntityKey,
  UpsertArgs,
} from './interface';
import {
  assertCompareVersionsResult,
  assertEntityKey,
  assertUpsertArgs,
} from './interface';

type StoredRow = {
  data: unknown;
  metadata: Record<string, unknown>;
  lastModifiedAt: Date;
};

function compositeKey(k: EntityKey): string {
  return `${k.namespace}\u0001${k.type}\u0001${k.id}`;
}

function cloneJson<T>(value: T): T {
  let out: unknown;
  assert.notThrows(
    () => {
      out = JSON.parse(JSON.stringify(value)) as T;
    },
    'entity-db (in-memory): JSON round-trip failed',
    { value }
  );
  return out as T;
}

/**
 * In-process {@link EntityDb} for tests. Serializes all operations through an internal async queue.
 */
export class EntityDbImplInMemory implements EntityDb {
  private readonly map = new Map<string, StoredRow>();
  private chain: Promise<void> = Promise.resolve();

  constructor(private readonly compareVersions: CompareVersions) {}

  private enqueue<R>(fn: () => Promise<R>): Promise<R> {
    const run = this.chain.then(fn);
    this.chain = run.then(
      () => {},
      () => {}
    );
    return run;
  }

  async upsert(args: UpsertArgs): Promise<{ applied: boolean }> {
    assertUpsertArgs(args);
    return this.enqueue(async () => this.upsertUnlocked(args));
  }

  private upsertUnlocked(args: UpsertArgs): { applied: boolean } {
    const key = compositeKey(args);
    const meta = args.metadata ?? {};
    const existing = this.map.get(key);
    if (existing === undefined) {
      this.map.set(key, {
        data: cloneJson(args.data),
        metadata: cloneJson(meta),
        lastModifiedAt: new Date(),
      });
      return { applied: true };
    }
    const cmp = this.compareVersions(args.data, existing.data);
    assertCompareVersionsResult(cmp, {
      namespace: args.namespace,
      type: args.type,
      id: args.id,
    });
    if (cmp <= 0) {
      return { applied: false };
    }
    this.map.set(key, {
      data: cloneJson(args.data),
      metadata: cloneJson(meta),
      lastModifiedAt: new Date(),
    });
    return { applied: true };
  }

  async get(key: EntityKey): Promise<Entity | null> {
    assertEntityKey(key);
    return this.enqueue(async () => {
      const row = this.map.get(compositeKey(key));
      if (row === undefined) return null;
      return {
        namespace: key.namespace,
        type: key.type,
        id: key.id,
        data: cloneJson(row.data),
        metadata: cloneJson(row.metadata),
        lastModifiedAt: new Date(row.lastModifiedAt.getTime()),
      };
    });
  }

  async delete(key: EntityKey): Promise<void> {
    assertEntityKey(key);
    await this.enqueue(async () => {
      this.map.delete(compositeKey(key));
    });
  }
}
