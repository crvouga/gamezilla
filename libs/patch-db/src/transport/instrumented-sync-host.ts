import { assert } from '@gamezilla/lib/assert';
import { createLogger, type Logger } from '@gamezilla/lib/logger';
import type { PubSub } from '@gamezilla/lib/pub-sub/interface';
import type {
  PatchDb,
  PatchDbContext,
  PatchDbQuery,
  PatchDbResult,
  PatchInput,
  WritePatchesResult,
} from '../interface';
import {
  OPEN_PATCHES_DB_CONTEXT,
  PATCHES_DB_SYSTEM_CONTEXT,
} from '../interface';
import { PATCH_DB_SYSTEM_DEVICE_ID } from '../policy/system-device';
import type { PatchDbSyncHost } from './interface';

const PATCHES_DB_TOPIC = 'patch-db';

/** Fixed entity for api instrumentation snapshot (entity type `admin.metric`). */
export const ADMIN_METRIC_ENTITY_ID = 'server-stats';
export const ADMIN_METRIC_ENTITY_TYPE = 'admin.metric';

type Counters = {
  totalPatchesWritten: number;
  totalReadsServed: number;
};

/**
 * Wraps a {@link PatchDbSyncHost}: counts traffic and periodically persists a
 * metric entity to `db` + pub/sub invalidation (bypasses inner `write` so
 * metrics do not inflate {@link Counters}).
 */
const defaultLog = createLogger({ name: 'patch-db:metrics' });

export type PatchDbImplInstrumentedSyncHostOptions = {
  inner: PatchDbSyncHost;
  db: PatchDb;
  pubSub: PubSub;
  flushIntervalMs?: number;
  logger?: Logger;
};

export class PatchDbImplInstrumentedSyncHost implements PatchDbSyncHost {
  private readonly inner: PatchDbSyncHost;
  private readonly db: PatchDb;
  private readonly pubSub: PubSub;
  private readonly flushIntervalMs: number;
  private readonly log: Logger;
  private readonly startedAt = new Date().toISOString();
  private readonly counters: Counters = {
    totalPatchesWritten: 0,
    totalReadsServed: 0,
  };
  private lastActivityAt = this.startedAt;
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: PatchDbImplInstrumentedSyncHostOptions) {
    const { inner, db, pubSub, flushIntervalMs = 5000, logger } = options;
    assert.nonNegativeInteger(
      flushIntervalMs,
      'flushIntervalMs must be a non-negative integer'
    );
    assert.defined(inner, 'instrumented host: inner required');
    assert.defined(db, 'instrumented host: db required');
    assert.defined(pubSub, 'instrumented host: pubSub required');
    this.inner = inner;
    this.db = db;
    this.pubSub = pubSub;
    this.flushIntervalMs = flushIntervalMs;
    this.log = logger ?? defaultLog;
    this.flushTimer = setInterval(() => {
      void this.flushMetricsSnapshot();
    }, this.flushIntervalMs);
    void this.flushMetricsSnapshot();
  }

  /** Stops periodic metric writes (e.g. tests). */
  dispose(): void {
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  async read(
    queries: PatchDbQuery[],
    ctx: PatchDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<PatchDbResult[]> {
    this.touchActivity();
    if (queries.length > 0) {
      this.counters.totalReadsServed += queries.length;
    }
    return this.inner.read(queries, ctx);
  }

  async write(
    patches: PatchInput[],
    ctx: PatchDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<WritePatchesResult> {
    this.touchActivity();
    this.counters.totalPatchesWritten += patches.length;
    return this.inner.write(patches, ctx);
  }

  private touchActivity(): void {
    this.lastActivityAt = new Date().toISOString();
  }

  private async flushMetricsSnapshot(): Promise<void> {
    const now = Date.now();
    const started = Date.parse(this.startedAt);
    const uptimeSeconds =
      Number.isFinite(started) && started > 0
        ? Math.max(0, Math.floor((now - started) / 1000))
        : 0;

    assert.nonNegativeInteger(
      uptimeSeconds,
      'uptimeSeconds must be a non-negative integer'
    );

    try {
      await this.db.write(
        [
          {
            entityId: ADMIN_METRIC_ENTITY_ID,
            entityType: ADMIN_METRIC_ENTITY_TYPE,
            attributes: {
              'patch/created-by-id': PATCH_DB_SYSTEM_DEVICE_ID,
              'admin/started-at': this.startedAt,
              'admin/uptime-seconds': uptimeSeconds,
              'admin/total-patches-written': this.counters.totalPatchesWritten,
              'admin/total-reads-served': this.counters.totalReadsServed,
              'admin/last-activity-at': this.lastActivityAt,
            },
          },
        ],
        PATCHES_DB_SYSTEM_CONTEXT
      );
      this.pubSub.publish(PATCHES_DB_TOPIC, { type: 'invalidated' });
    } catch (err) {
      this.log.error('flushMetricsSnapshot failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
