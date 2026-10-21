import type { JsonValue } from './json';
import { canonicalJsonStringify } from './json';

/** One entry in a Trace: a resolved Step or a Scheduler / Network event. */
export type TraceRecord =
  | {
      readonly type: 'choice';
      readonly id: string;
      readonly index: number;
      readonly size: number;
      readonly consumed: boolean;
    }
  | {
      readonly type: 'task_create';
      readonly taskId: number;
      readonly at: number;
      readonly label?: string;
    }
  | {
      readonly type: 'task_fire';
      readonly taskId: number;
      readonly at: number;
    }
  | {
      readonly type: 'network';
      readonly op: string;
      readonly from: string;
      readonly to: string;
      readonly detail?: JsonValue;
    };

/** Sink that receives TraceRecords while a Run executes. */
export type TraceRecorder = {
  readonly enabled: boolean;
  readonly record: (e: TraceRecord) => void;
  readonly records: () => readonly TraceRecord[];
};

function formatRecord(r: TraceRecord): string {
  return canonicalJsonStringify(r as unknown as JsonValue);
}

export const NOOP_TRACE_RECORDER: TraceRecorder = {
  enabled: false,
  record() {},
  records: () => [],
};

export function createTraceRecorder(): TraceRecorder {
  const buf: TraceRecord[] = [];
  return {
    enabled: true,
    record(e) {
      buf.push(e);
    },
    records: () => buf.slice(),
  };
}

/**
 * Replay mode: every record produced by the run is checked against the
 * recorded Trace in order; the first mismatch fails loudly with its position.
 */
export function createTraceResolver(
  recorded: readonly TraceRecord[]
): TraceRecorder & { assertFullyConsumed: () => void } {
  let pos = 0;
  const check = (actual: TraceRecord): void => {
    if (pos >= recorded.length) {
      throw new Error(
        `Trace replay: extra record at ${pos}: ${formatRecord(actual)}`
      );
    }
    const expected = recorded[pos]!;
    if (formatRecord(expected) !== formatRecord(actual)) {
      throw new Error(
        `Trace replay divergence at ${pos}:\n` +
          `  expected: ${formatRecord(expected)}\n` +
          `  actual:   ${formatRecord(actual)}`
      );
    }
    pos += 1;
  };
  return {
    enabled: true,
    record: check,
    records: () => recorded.slice(0, pos),
    assertFullyConsumed() {
      if (pos !== recorded.length) {
        throw new Error(
          `Trace replay: only consumed ${pos}/${recorded.length} records`
        );
      }
    },
  };
}
