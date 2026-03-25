import type {
  PatchInput,
  PatchesDbQuery,
  PatchesDbResult,
} from '../../interface';

/** True when sim should record events and persist on destroy. */
export function isSimVizEnabled(): boolean {
  const v = process.env.SIM_VIZ;
  return v === '1' || v === 'true';
}

export type SimTopology = {
  servers: { id: string; useSyncHost: boolean }[];
  clients: { id: string; serverId: string }[];
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

export type SimRecording = {
  id: string;
  topology: SimTopology;
  events: SimEvent[];
  startedAt: number;
  endedAt: number;
};

/** Payload for {@link SimEventRecorder.emit} (`seq` is always assigned by the recorder). */
export type SimEventInput = {
  [K in SimEvent['type']]: Omit<Extract<SimEvent, { type: K }>, 'seq'>;
}[SimEvent['type']];

export function summarizePatchInputs(
  patches: PatchInput[]
): PatchInputSummary[] {
  return patches.map((p) => ({
    entityId: p.entityId,
    entityType: p.entityType,
    attributeKeys: Object.keys(p.attributes ?? {}),
  }));
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

export class SimEventRecorder {
  private seq = 0;
  private readonly events: SimEvent[] = [];
  private topology: SimTopology = { servers: [], clients: [] };
  readonly id: string;
  readonly startedAt: number;

  constructor(
    private readonly getTime: () => number,
    id?: string
  ) {
    this.id = id ?? crypto.randomUUID();
    this.startedAt = this.getTime();
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
    return {
      id: this.id,
      topology: this.topology,
      events: [...this.events],
      startedAt: this.startedAt,
      endedAt: this.getTime(),
    };
  }
}
