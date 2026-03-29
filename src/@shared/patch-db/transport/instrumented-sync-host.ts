import { assert } from '../../assert';
import type { PubSub } from '../../pub-sub/interface';
import type {
  Patch,
  PatchesDb,
  PatchesDbQuery,
  PatchesDbResult,
  PatchInput,
} from '../interface';
import type { PatchDbSyncHost } from './interface';

const PATCHES_DB_TOPIC = 'patches-db';

/** Fixed entity for sync-server instrumentation snapshot (see plan: admin/metric). */
export const ADMIN_METRIC_ENTITY_ID = 'server-stats';
export const ADMIN_METRIC_ENTITY_TYPE = 'admin/metric';

type Counters = {
  totalPatchesWritten: number;
  totalReadsServed: number;
  activeConnections: number;
};

/**
 * Wraps a {@link PatchDbSyncHost}: counts traffic, tracks live SSE subscribers,
 * and periodically persists a metric entity to `db` + pub/sub invalidation
 * (bypasses inner `write` so metrics do not inflate {@link Counters}).
 */
export class PatchDbImplInstrumentedSyncHost implements PatchDbSyncHost {
  private readonly startedAt = new Date().toISOString();
  private readonly counters: Counters = {
    totalPatchesWritten: 0,
    totalReadsServed: 0,
    activeConnections: 0,
  };
  private lastActivityAt = this.startedAt;
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly inner: PatchDbSyncHost,
    private readonly db: PatchesDb,
    private readonly pubSub: PubSub,
    private readonly flushIntervalMs = 5000
  ) {
    assert.nonNegativeInteger(
      flushIntervalMs,
      'flushIntervalMs must be a non-negative integer'
    );
    assert.defined(inner, 'instrumented host: inner required');
    assert.defined(db, 'instrumented host: db required');
    assert.defined(pubSub, 'instrumented host: pubSub required');
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

  async read(queries: PatchesDbQuery[]): Promise<PatchesDbResult[]> {
    this.touchActivity();
    if (queries.length > 0) {
      this.counters.totalReadsServed += queries.length;
    }
    return this.inner.read(queries);
  }

  async write(patches: PatchInput[]): Promise<Patch[]> {
    this.touchActivity();
    this.counters.totalPatchesWritten += patches.length;
    return this.inner.write(patches);
  }

  subscribe(callback: () => void): () => void {
    this.counters.activeConnections += 1;
    const innerUnsub = this.inner.subscribe(callback);
    return () => {
      this.counters.activeConnections = Math.max(
        0,
        this.counters.activeConnections - 1
      );
      innerUnsub();
    };
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
      await this.db.write([
        {
          entityId: ADMIN_METRIC_ENTITY_ID,
          entityType: ADMIN_METRIC_ENTITY_TYPE,
          attributes: {
            'admin/startedAt': this.startedAt,
            'admin/uptimeSeconds': uptimeSeconds,
            'admin/totalPatchesWritten': this.counters.totalPatchesWritten,
            'admin/totalReadsServed': this.counters.totalReadsServed,
            'admin/activeConnections': this.counters.activeConnections,
            'admin/lastActivityAt': this.lastActivityAt,
          },
        },
      ]);
      this.pubSub.publish(PATCHES_DB_TOPIC, { type: 'invalidated' });
    } catch (err) {
      console.error('[patch-db] flushMetricsSnapshot failed:', err);
    }
  }
}
