import type { PatchInput, PatchesDbQuery, PatchesDbResult } from '../interface';

/**
 * True when sim should record events and persist on destroy.
 * TODO: Re-enable when patchdb-app recording returns (e.g. `PATCHDB_APP_RECORDING=1`).
 */
export function isPatchDbAppEnabled(): boolean {
  return false;
}

export type SimTopology = {
  servers: { id: string; useSyncHost: boolean }[];
  clients: { id: string; serverId: string }[];
};

export type SimRecordingMetaSource = {
  testFile?: string;
  suite?: string;
  testName?: string;
};

/** Human context for viz (JSON-safe). Set via {@link SimEventRecorder.setMeta} / {@link Sim.setRecordingMeta}. */
export type SimRecordingMeta = {
  title?: string;
  description?: string;
  /** One-line: what the test proves. */
  intent?: string;
  source?: SimRecordingMetaSource;
  tags?: string[];
};

/** JSON-safe summaries only (no circular refs). */
export type PatchInputSummary = {
  entityId: string;
  entityType: string;
  attributeKeys: string[];
};

export type QuerySummary = {
  entityType?: string;
  entityId?: string | string[];
  hasWhere: boolean;
  limit?: number;
  on?: 'patches' | 'entities';
};

export type ResultSummary = {
  entityCount: number;
  patchCount: number;
};

export type SimEvent =
  | {
      type: 'topology';
      seq: number;
      time: number;
      topology: SimTopology;
    }
  | {
      type: 'client_write';
      seq: number;
      time: number;
      clientId: string;
      summaries: PatchInputSummary[];
      patchCount: number;
    }
  | {
      type: 'push_start';
      seq: number;
      time: number;
      clientId: string;
    }
  | {
      type: 'push_success';
      seq: number;
      time: number;
      clientId: string;
    }
  | {
      type: 'push_fail';
      seq: number;
      time: number;
      clientId: string;
      errorMessage: string;
    }
  | {
      type: 'poll_start';
      seq: number;
      time: number;
      clientId: string;
    }
  | {
      type: 'poll_success';
      seq: number;
      time: number;
      clientId: string;
    }
  | {
      type: 'poll_fail';
      seq: number;
      time: number;
      clientId: string;
      errorMessage: string;
    }
  | {
      type: 'network_op';
      seq: number;
      time: number;
      clientId: string;
      op: 'read' | 'write';
      phase: 'begin' | 'end';
      ok?: boolean;
      durationMs?: number;
      errorMessage?: string;
    }
  | {
      type: 'remote_read';
      seq: number;
      time: number;
      clientId: string;
      queries: QuerySummary[];
      results: ResultSummary[];
      /** Entities returned by the read, so the viz can update the client's known-entity set. */
      summaries: PatchInputSummary[];
    }
  | {
      type: 'remote_write';
      seq: number;
      time: number;
      clientId: string;
      summaries: PatchInputSummary[];
      returnedPatchCount: number;
    }
  | {
      type: 'partition';
      seq: number;
      time: number;
      clientId: string;
    }
  | {
      type: 'heal';
      seq: number;
      time: number;
      clientId: string;
    }
  | {
      type: 'invalidation_scheduled';
      seq: number;
      time: number;
      clientId: string;
      delayMs: number;
    }
  | {
      type: 'invalidation_delivered';
      seq: number;
      time: number;
      clientId: string;
    }
  | {
      type: 'invalidation_dropped';
      seq: number;
      time: number;
      clientId: string;
      reason: 'partitioned_at_schedule' | 'partitioned_before_delivery';
    }
  | {
      type: 'subscribe';
      seq: number;
      time: number;
      clientId: string;
      mode: 'patches' | 'entities';
      queryKey: string;
    }
  | {
      type: 'unsubscribe';
      seq: number;
      time: number;
      clientId: string;
      mode: 'patches' | 'entities';
      queryKey: string;
    }
  | {
      type: 'server_write';
      seq: number;
      time: number;
      serverId: string;
      summaries: PatchInputSummary[];
      patchCount: number;
    }
  | {
      type: 'sync_error';
      seq: number;
      time: number;
      clientId: string;
      source: 'push' | 'poll';
      errorMessage: string;
    };

/** Optional hints for the sim HTML viz (safe to ignore). */
export type SimRecordingVizMeta = {
  /** Schema version for the viz bundle. */
  schema: 1;
  /** Use discrete timeline steps (one per event, ordered by `seq`). */
  timeline: 'discrete-seq';
  /** Same as `events.length` after finalize. */
  stepCount: number;
};

export type SimRecording = {
  id: string;
  topology: SimTopology;
  events: SimEvent[];
  startedAt: number;
  endedAt: number;
  meta?: SimRecordingMeta;
  /** Present when recorded with {@link isPatchDbAppEnabled}. */
  viz?: SimRecordingVizMeta;
};

function buildMetaSnapshot(
  acc: SimRecordingMeta
): SimRecordingMeta | undefined {
  const out: SimRecordingMeta = {};
  if (acc.title !== undefined) out.title = acc.title;
  if (acc.description !== undefined) out.description = acc.description;
  if (acc.intent !== undefined) out.intent = acc.intent;
  if (acc.tags !== undefined && acc.tags.length > 0) out.tags = acc.tags;
  if (acc.source !== undefined) {
    const s: SimRecordingMetaSource = {};
    if (acc.source.testFile !== undefined) s.testFile = acc.source.testFile;
    if (acc.source.suite !== undefined) s.suite = acc.source.suite;
    if (acc.source.testName !== undefined) s.testName = acc.source.testName;
    if (Object.keys(s).length > 0) out.source = s;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Payload for {@link SimEventRecorder.emit} (`seq` is always assigned by the recorder). */
export type SimEventInput = {
  [K in SimEvent['type']]: Omit<Extract<SimEvent, { type: K }>, 'seq'>;
}[SimEvent['type']];

export function summarizePatchInputs(
  patches: PatchInput[]
): PatchInputSummary[] {
  return patches.map((p) => {
    const prefix = p.entityType + '/';
    return {
      entityId: p.entityId,
      entityType: p.entityType,
      attributeKeys: Object.keys(p.attributes ?? {}).filter((k) =>
        k.startsWith(prefix)
      ),
    };
  });
}

export function summarizeQueries(queries: PatchesDbQuery[]): QuerySummary[] {
  return queries.map((q) => {
    const s: QuerySummary = {
      hasWhere: q.where !== undefined && q.where !== null,
    };
    if (q.entityType !== undefined) {
      s.entityType = q.entityType;
    }
    if (q.entityId !== undefined) {
      s.entityId = q.entityId;
    }
    if (q.limit !== undefined) {
      s.limit = q.limit;
    }
    if (q.on !== undefined) {
      s.on = q.on;
    }
    return s;
  });
}

export function summarizeResults(results: PatchesDbResult[]): ResultSummary[] {
  return results.map((r) => ({
    entityCount: r.entities.length,
    patchCount: r.patches.length,
  }));
}

export function summarizeResultEntities(
  results: PatchesDbResult[]
): PatchInputSummary[] {
  const seen = new Set<string>();
  const out: PatchInputSummary[] = [];
  for (const r of results) {
    for (const e of r.entities) {
      if (seen.has(e.entityId)) continue;
      seen.add(e.entityId);
      out.push({
        entityId: e.entityId,
        entityType: e.entityType,
        attributeKeys: Object.keys(e.attributes ?? {}),
      });
    }
  }
  return out;
}

export class SimEventRecorder {
  private seq = 0;
  private readonly events: SimEvent[] = [];
  private topology: SimTopology = { servers: [], clients: [] };
  private metaAcc: SimRecordingMeta = {};
  readonly id: string;
  readonly startedAt: number;

  constructor(
    private readonly getTime: () => number,
    id?: string
  ) {
    this.id = id ?? crypto.randomUUID();
    this.startedAt = this.getTime();
  }

  /** Shallow-merge recording metadata; `source` fields merge with previous `source`. */
  setMeta(partial: Partial<SimRecordingMeta>): void {
    if (partial.title !== undefined) {
      this.metaAcc.title = partial.title;
    }
    if (partial.description !== undefined) {
      this.metaAcc.description = partial.description;
    }
    if (partial.intent !== undefined) {
      this.metaAcc.intent = partial.intent;
    }
    if (partial.tags !== undefined) {
      this.metaAcc.tags = partial.tags;
    }
    if (partial.source !== undefined) {
      this.metaAcc.source = {
        ...this.metaAcc.source,
        ...partial.source,
      };
    }
  }

  /** Set topology and emit a topology event on the timeline. */
  setTopology(topology: SimTopology): void {
    this.topology = topology;
    this.emit({
      type: 'topology',
      topology,
      time: this.getTime(),
    });
  }

  private nextSeq(): number {
    this.seq += 1;
    return this.seq;
  }

  emit(event: SimEventInput): void {
    const seq = this.nextSeq();
    const time =
      'time' in event && typeof event.time === 'number'
        ? event.time
        : this.getTime();
    this.events.push({ ...event, seq, time } as SimEvent);
  }

  getEvents(): readonly SimEvent[] {
    return this.events;
  }

  finalize(): SimRecording {
    const endedAt = this.getTime();
    const meta = buildMetaSnapshot(this.metaAcc);
    const events = [...this.events];
    const rec: SimRecording = {
      id: this.id,
      topology: this.topology,
      events,
      startedAt: this.startedAt,
      endedAt,
    };
    if (meta !== undefined) {
      rec.meta = meta;
    }
    if (isPatchDbAppEnabled()) {
      rec.viz = {
        schema: 1,
        timeline: 'discrete-seq',
        stepCount: events.length,
      };
    }
    return rec;
  }
}
