export type SimTraceEvent =
  | {
      readonly seq: number;
      readonly now: number;
      readonly type: 'lifecycle';
      readonly phase:
        | 'boot'
        | 'chaos'
        | 'prepare_converge'
        | 'settle'
        | 'dispose';
    }
  | {
      readonly seq: number;
      readonly now: number;
      readonly type: 'step';
      readonly index: number;
      readonly action: unknown;
    }
  | {
      readonly seq: number;
      readonly now: number;
      readonly type: 'schedule';
      readonly at: number;
      readonly taskId: number;
    }
  | {
      readonly seq: number;
      readonly now: number;
      readonly type: 'execute';
      readonly taskId: number;
    }
  | {
      readonly seq: number;
      readonly now: number;
      readonly type: 'clock';
      readonly op: 'set' | 'advance' | 'reset';
      readonly arg: number;
    }
  | {
      readonly seq: number;
      readonly now: number;
      readonly type: 'net_send';
      readonly from: string;
      readonly to: string;
      readonly key?: string;
      readonly packetId: number;
    }
  | {
      readonly seq: number;
      readonly now: number;
      readonly type: 'net_deliver';
      readonly from: string;
      readonly to: string;
      readonly packetId: number;
    }
  | {
      readonly seq: number;
      readonly now: number;
      readonly type: 'net_drop';
      readonly reason: 'loss' | 'partition' | 'unregistered';
      readonly from: string;
      readonly to: string;
      readonly packetId?: number;
    }
  | {
      readonly seq: number;
      readonly now: number;
      readonly type: 'net_hold';
      readonly key: string;
      readonly op: 'enqueue' | 'release_flush';
      readonly packetId: number;
    }
  | {
      readonly seq: number;
      readonly now: number;
      readonly type: 'fault_arm' | 'fault_take';
      readonly id: string;
      readonly target: string;
      readonly dedupeKey?: string;
    }
  | {
      readonly seq: number;
      readonly now: number;
      readonly type: 'invariant';
      readonly invariant: string;
      readonly detail: string;
    };

/** Distributes Omit over each SimTraceEvent variant (plain Omit breaks unions). */
export type SimTraceEventInput = SimTraceEvent extends infer E
  ? E extends SimTraceEvent
    ? Omit<E, 'seq'>
    : never
  : never;

export type SimTrace = {
  readonly enabled: boolean;
  readonly record: (e: SimTraceEventInput) => void;
  readonly events: () => readonly SimTraceEvent[];
  readonly clear: () => void;
};

export function createSimTrace(enabled = false): SimTrace {
  if (!enabled) {
    return {
      enabled: false,
      record() {},
      events: () => [],
      clear() {},
    };
  }
  const buf: SimTraceEvent[] = [];
  let seq = 0;
  return {
    enabled: true,
    record(e) {
      buf.push({ ...e, seq: seq++ } as SimTraceEvent);
    },
    events: () => buf.slice(),
    clear() {
      buf.length = 0;
    },
  };
}
