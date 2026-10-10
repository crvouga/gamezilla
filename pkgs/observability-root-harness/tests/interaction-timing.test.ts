import { afterAll, afterEach, beforeAll, expect, test } from 'bun:test';
import { trace } from '@opentelemetry/api';
import {
  InMemorySpanExporter,
  type ReadableSpan,
} from '@opentelemetry/sdk-trace-base';
import type { BrowserTelemetry } from '@pkgs/observability-root-client/browser';
import { createBrowserTelemetry } from '@pkgs/observability-root-client/browser';
import {
  installInteractionTiming,
  recordInteractionTiming,
  type TimedFrame,
  type TimedInput,
} from '@pkgs/observability-root-client/interaction-timing';
import { ATTR } from '@pkgs/observability-root-shared/attributes';

const TIME_ORIGIN_MS = 1_700_000_000_000;
const SCRIPT_FILE = 'pkgs/chess-board-root-client/src/chess-board-pointer.ts';

const DROP: TimedInput = {
  name: 'pointerup',
  startTimeMs: 1_000,
  durationMs: 180,
  processingStartMs: 1_004,
  processingEndMs: 1_140,
  target: 'component:ChessBoard',
};

type Listed = {
  getEntries(): PerformanceEntry[];
};

class RecordingObserver {
  readonly #onEntries: (list: Listed) => void;
  options?: { type: string; durationThreshold?: number };

  constructor(onEntries: (list: Listed) => void) {
    this.#onEntries = onEntries;
    created.push(this);
  }

  observe(options: { type: string; durationThreshold?: number }): void {
    this.options = options;
  }

  disconnect(): void {}

  emit(entries: PerformanceEntry[]): void {
    this.#onEntries({ getEntries: () => entries });
  }
}

const created: RecordingObserver[] = [];
let exporter: InMemorySpanExporter;
let runtime: BrowserTelemetry;

beforeAll(() => {
  exporter = new InMemorySpanExporter();
  runtime = createBrowserTelemetry({
    serviceName: 'interaction-timing',
    serviceVersion: '1',
    environment: 'test',
    buildSha: 'abc',
    registerGlobal: true,
    exporter,
    instrumentFetch: false,
  });
});

afterEach(() => {
  exporter.reset();
  created.length = 0;
});

afterAll(async () => {
  await runtime.shutdown();
  trace.disable();
});

test('a pointerup span splits delay, work, paint, and the longest script', async () => {
  recordInteractionTiming({
    timeOriginMs: TIME_ORIGIN_MS,
    inputs: [DROP],
    frames: [
      {
        startTimeMs: 1_000,
        durationMs: 160,
        scripts: [
          { functionName: 'onUp', filePath: SCRIPT_FILE, durationMs: 120 },
          { functionName: 'shorter', filePath: 'other.ts', durationMs: 10 },
        ],
      },
    ],
  });
  const span = await onlySpan();
  expect(span.name).toBe('interaction.timing');
  expect(epochMs(span.startTime)).toBe(TIME_ORIGIN_MS + DROP.startTimeMs);
  expect(epochMs(span.endTime) - epochMs(span.startTime)).toBe(180);
  expect(span.attributes[ATTR.APP_INTERACTION_TYPE]).toBe('pointerup');
  expect(span.attributes[ATTR.APP_INTERACTION_TARGET]).toBe(
    'component:ChessBoard'
  );
  expect(span.attributes[ATTR.APP_INTERACTION_INPUT_DELAY_MS]).toBe(4);
  expect(span.attributes[ATTR.APP_INTERACTION_PROCESSING_MS]).toBe(136);
  expect(span.attributes[ATTR.APP_INTERACTION_PRESENTATION_MS]).toBe(40);
  expect(span.attributes[ATTR.APP_INTERACTION_FRAME_MS]).toBe(160);
  expect(span.attributes[ATTR.APP_INTERACTION_SCRIPT_MS]).toBe(120);
  expect(span.attributes[ATTR.CODE_FUNCTION_NAME]).toBe('onUp');
  expect(span.attributes[ATTR.CODE_FILE_PATH]).toBe(SCRIPT_FILE);
});

test('a frame outside the input does not blame a script', async () => {
  const frame: TimedFrame = {
    startTimeMs: 2_000,
    durationMs: 90,
    scripts: [{ functionName: 'later', filePath: 'later.ts', durationMs: 40 }],
  };
  recordInteractionTiming({
    timeOriginMs: TIME_ORIGIN_MS,
    inputs: [DROP],
    frames: [frame],
  });
  const span = await onlySpan();
  expect(span.attributes[ATTR.APP_INTERACTION_FRAME_MS]).toBeUndefined();
  expect(span.attributes[ATTR.APP_INTERACTION_SCRIPT_MS]).toBeUndefined();
  expect(span.attributes[ATTR.CODE_FUNCTION_NAME]).toBeUndefined();
  expect(span.attributes[ATTR.CODE_FILE_PATH]).toBeUndefined();
});

test('an empty script name is left off the span', async () => {
  recordInteractionTiming({
    timeOriginMs: TIME_ORIGIN_MS,
    inputs: [DROP],
    frames: [
      {
        startTimeMs: 1_000,
        durationMs: 50,
        scripts: [{ functionName: '', filePath: '', durationMs: 30 }],
      },
    ],
  });
  const span = await onlySpan();
  expect(span.attributes[ATTR.APP_INTERACTION_FRAME_MS]).toBe(50);
  expect(span.attributes[ATTR.APP_INTERACTION_SCRIPT_MS]).toBe(30);
  expect(span.attributes[ATTR.CODE_FUNCTION_NAME]).toBeUndefined();
  expect(span.attributes[ATTR.CODE_FILE_PATH]).toBeUndefined();
});

test('pointer moves are ignored and the frame is visible after one microtask', async () => {
  const remove = installInteractionTiming({
    timeOriginMs: TIME_ORIGIN_MS,
    targetName: () => 'component:ChessBoard',
    Observer: RecordingObserver,
  });
  expect(created.map((observer) => observer.options)).toEqual([
    { type: 'long-animation-frame' },
    { type: 'event', durationThreshold: 16 },
  ]);
  created[0]?.emit([
    entry('long-animation-frame', 1_000, 160, {
      scripts: [
        { sourceFunctionName: 'onUp', sourceURL: SCRIPT_FILE, duration: 120 },
      ],
    }),
  ]);
  created[1]?.emit([
    entry('pointermove', 1_000, 40, {}),
    entry('pointerup', 1_000, 180, {
      processingStart: 1_004,
      processingEnd: 1_140,
    }),
  ]);
  await Promise.resolve();
  const span = await onlySpan();
  expect(span.attributes[ATTR.APP_INTERACTION_TYPE]).toBe('pointerup');
  expect(span.attributes[ATTR.APP_INTERACTION_SCRIPT_MS]).toBe(120);
  expect(span.attributes[ATTR.CODE_FUNCTION_NAME]).toBe('onUp');
  remove();
});

function entry(
  name: string,
  startTime: number,
  duration: number,
  extra: Record<string, unknown>
): PerformanceEntry {
  return {
    name,
    entryType: name,
    startTime,
    duration,
    toJSON: () => ({}),
    ...extra,
  } as PerformanceEntry;
}

async function onlySpan(): Promise<ReadableSpan> {
  await runtime.forceFlush();
  const spans = exporter.getFinishedSpans();
  expect(spans).toHaveLength(1);
  const span = spans[0];
  if (span === undefined) throw new Error('missing span');
  return span;
}

function epochMs(value: readonly [number, number]): number {
  return value[0] * 1_000 + value[1] / 1e6;
}
