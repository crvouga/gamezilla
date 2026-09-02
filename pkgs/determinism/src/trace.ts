import { canonicalJsonStringify, type JsonValue } from './json';

export type TraceRecord =
  | {
      readonly type: 'sample';
      readonly reason: string;
      readonly index: number;
      readonly size: number;
      readonly consumed: boolean;
    }
  | {
      readonly type: 'entropy';
      readonly reason: string;
      readonly value: number;
    }
  | {
      readonly type: 'timer_create';
      readonly taskId: number;
      readonly at: number;
      readonly reason?: string;
    }
  | {
      readonly type: 'timer_fire';
      readonly taskId: number;
      readonly at: number;
    }
  | {
      readonly type: 'timer_cancel';
      readonly taskId: number;
    }
  | {
      readonly type: 'net';
      readonly op: string;
      readonly from: string;
      readonly to: string;
      readonly detail?: JsonValue;
    }
  | {
      readonly type: 'lifecycle';
      readonly phase: string;
      readonly now: number;
    }
  | {
      readonly type: 'step';
      readonly index: number;
      readonly action: JsonValue;
      readonly now: number;
    }
  | {
      readonly type: 'invariant';
      readonly invariant: string;
      readonly detail: string;
      readonly now: number;
    };

export type SimTrace = {
  readonly enabled: boolean;
  readonly record: (e: TraceRecord) => void;
  readonly events: () => readonly TraceRecord[];
};

function formatRecord(r: TraceRecord): string {
  return canonicalJsonStringify(r as unknown as JsonValue);
}

export function createDisabledTrace(): SimTrace {
  return { enabled: false, record() {}, events: () => [] };
}

export function createRecordingTrace(): SimTrace {
  const buf: TraceRecord[] = [];
  return {
    enabled: true,
    record(e) {
      buf.push(e);
    },
    events: () => buf.slice(),
  };
}

export function createReplayingTrace(
  recorded: readonly TraceRecord[]
): SimTrace & { assertFullyConsumed: () => void } {
  let pos = 0;
  const check = (actual: TraceRecord): void => {
    if (pos >= recorded.length) {
      throw new Error(
        `SimTrace replay: extra event at ${pos}: ${formatRecord(actual)}`
      );
    }
    const expected = recorded[pos]!;
    if (formatRecord(expected) !== formatRecord(actual)) {
      throw new Error(
        `SimTrace replay divergence at ${pos}:\n` +
          `  expected: ${formatRecord(expected)}\n` +
          `  actual:   ${formatRecord(actual)}`
      );
    }
    pos += 1;
  };
  return {
    enabled: true,
    record: check,
    events: () => recorded.slice(0, pos),
    assertFullyConsumed() {
      if (pos !== recorded.length) {
        throw new Error(
          `SimTrace replay: only consumed ${pos}/${recorded.length} events`
        );
      }
    },
  };
}
