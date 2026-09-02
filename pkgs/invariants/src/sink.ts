export type InvariantHit = {
  readonly id: string;
  readonly at: number;
  readonly details?: string;
};

export type InvariantSink = {
  readonly recordAlways: (id: string, at: number) => void;
  readonly recordSometimes: (id: string, at: number) => void;
  readonly recordReachable: (id: string, at: number, details?: string) => void;
  readonly recordUnreachable: (
    id: string,
    at: number,
    details?: string
  ) => void;
  readonly hits: () => readonly InvariantHit[];
  readonly sometimesHits: () => ReadonlyMap<string, number>;
  readonly reachableHits: () => ReadonlyMap<string, number>;
  readonly reset: () => void;
};

const NOOP_SINK: InvariantSink = {
  recordAlways: () => undefined,
  recordSometimes: () => undefined,
  recordReachable: () => undefined,
  recordUnreachable: () => undefined,
  hits: () => [],
  sometimesHits: () => new Map(),
  reachableHits: () => new Map(),
  reset: () => undefined,
};

function createRecordingSink(): InvariantSink {
  const hits: InvariantHit[] = [];
  const sometimes = new Map<string, number>();
  const reachable = new Map<string, number>();

  return {
    recordAlways(id, at) {
      hits.push({ id, at });
    },
    recordSometimes(id, at) {
      hits.push({ id, at });
      sometimes.set(id, (sometimes.get(id) ?? 0) + 1);
    },
    recordReachable(id, at, details) {
      hits.push({ id, at, ...(details !== undefined ? { details } : {}) });
      reachable.set(id, (reachable.get(id) ?? 0) + 1);
    },
    recordUnreachable(id, at, details) {
      hits.push({ id, at, ...(details !== undefined ? { details } : {}) });
    },
    hits: () => hits,
    sometimesHits: () => sometimes,
    reachableHits: () => reachable,
    reset() {
      hits.length = 0;
      sometimes.clear();
      reachable.clear();
    },
  };
}

let activeSink: InvariantSink = NOOP_SINK;
let bound = false;

export function bindInvariantSink(sink?: InvariantSink): InvariantSink {
  if (bound) {
    throw new Error('bindInvariantSink: sink already bound');
  }
  bound = true;
  activeSink = sink ?? createRecordingSink();
  return activeSink;
}

export function unbindInvariantSink(): void {
  activeSink = NOOP_SINK;
  bound = false;
}

export function currentInvariantSink(): InvariantSink {
  return activeSink;
}

export function isInvariantSinkBound(): boolean {
  return bound;
}
