import type { Attributes } from '@pkgs/observability-root-shared-ts/attributes';
import { ATTR } from '@pkgs/observability-root-shared-ts/attributes';
import { startSpan } from '@pkgs/observability-root-shared-ts/span';

/** Discrete inputs whose felt duration we can attribute. Pointer moves are not
 * included: a drag would emit one span per event and hide the drop. */
export const RECORDED_INTERACTION_TYPES = [
  'click',
  'pointerdown',
  'pointerup',
  'keydown',
] as const;

export type RecordedInteractionType =
  (typeof RECORDED_INTERACTION_TYPES)[number];

const RECORDED = new Set<string>(RECORDED_INTERACTION_TYPES);
const FRAME_LIMIT = 8;

export type TimedInput = {
  readonly name: RecordedInteractionType;
  readonly startTimeMs: number;
  readonly durationMs: number;
  readonly processingStartMs: number;
  readonly processingEndMs: number;
  readonly target: string | null;
};

export type TimedScript = {
  readonly functionName: string;
  readonly filePath: string;
  readonly durationMs: number;
};

export type TimedFrame = {
  readonly startTimeMs: number;
  readonly durationMs: number;
  readonly scripts: readonly TimedScript[];
};

type EntryObserver = {
  observe(options: { type: string; durationThreshold?: number }): void;
  disconnect(): void;
};

type ObserverCtor = new (
  callback: (list: { getEntries(): PerformanceEntry[] }) => void
) => EntryObserver;

/** One span per slow input. Duration is the Event Timing duration, which
 * includes presentation, so `bun obs slow` ranks the lag a person felt. */
export function recordInteractionTiming(args: {
  readonly inputs: readonly TimedInput[];
  readonly frames: readonly TimedFrame[];
  readonly timeOriginMs: number;
}): void {
  for (const input of args.inputs) {
    recordInput(input, args.frames, args.timeOriginMs);
  }
}

/**
 * Event Timing plus the long animation frame that overlapped it.
 * The frame observer is registered first and the flush waits one microtask
 * so both notifications from the same frame are visible before the span ends.
 */
export function installInteractionTiming(args: {
  readonly timeOriginMs: number;
  readonly targetName: (target: EventTarget | null) => string | null;
  readonly Observer?: ObserverCtor;
}): () => void {
  if (!Number.isFinite(args.timeOriginMs)) return () => undefined;
  const Observer = args.Observer ?? readObserver();
  if (Observer === undefined) return () => undefined;
  const frames: TimedFrame[] = [];
  const pending: TimedInput[] = [];
  let scheduled = false;
  const flush = () => {
    scheduled = false;
    const inputs = pending.splice(0, pending.length);
    recordInteractionTiming({
      inputs,
      frames,
      timeOriginMs: args.timeOriginMs,
    });
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(flush);
  };
  const frameObs = observeFirst(
    Observer,
    ['long-animation-frame', 'longtask'],
    (entries) => {
      rememberFrames(frames, entries);
      schedule();
    }
  );
  const inputObs = observeFirst(Observer, ['event'], (entries) => {
    for (const entry of entries) {
      const input = inputFromEntry(entry, args.targetName);
      if (input !== null) pending.push(input);
    }
    schedule();
  });
  return () => {
    frameObs?.disconnect();
    inputObs?.disconnect();
  };
}

function recordInput(
  input: TimedInput,
  frames: readonly TimedFrame[],
  timeOriginMs: number
): void {
  if (!Number.isFinite(input.durationMs) || input.durationMs <= 0) return;
  const spent = input.processingEndMs - input.startTimeMs;
  const frame = overlappingFrame(input, frames);
  const script = longestScript(frame);
  const attributes: Attributes = {
    [ATTR.APP_INTERACTION_TYPE]: input.name,
    [ATTR.APP_INTERACTION_INPUT_DELAY_MS]: elapsedMs(
      input.processingStartMs - input.startTimeMs
    ),
    [ATTR.APP_INTERACTION_PROCESSING_MS]: elapsedMs(
      input.processingEndMs - input.processingStartMs
    ),
    [ATTR.APP_INTERACTION_PRESENTATION_MS]: elapsedMs(input.durationMs - spent),
    ...(input.target === null
      ? {}
      : { [ATTR.APP_INTERACTION_TARGET]: input.target }),
    ...(frame === null
      ? {}
      : { [ATTR.APP_INTERACTION_FRAME_MS]: elapsedMs(frame.durationMs) }),
    ...scriptAttributes(script),
  };
  const startMs = timeOriginMs + input.startTimeMs;
  const span = startSpan('interaction.timing', attributes, {
    startTime: startMs,
  });
  span.end(startMs + input.durationMs);
}

function overlappingFrame(
  input: TimedInput,
  frames: readonly TimedFrame[]
): TimedFrame | null {
  const inputEnd = input.startTimeMs + input.durationMs;
  let best: TimedFrame | null = null;
  for (const frame of frames) {
    const frameEnd = frame.startTimeMs + frame.durationMs;
    if (frame.startTimeMs > inputEnd || frameEnd < input.startTimeMs) continue;
    if (best === null || frame.durationMs > best.durationMs) best = frame;
  }
  return best;
}

function scriptAttributes(script: TimedScript | null): Attributes {
  if (script === null) return {};
  return {
    [ATTR.APP_INTERACTION_SCRIPT_MS]: elapsedMs(script.durationMs),
    ...(script.functionName === ''
      ? {}
      : { [ATTR.CODE_FUNCTION_NAME]: script.functionName }),
    ...(script.filePath === ''
      ? {}
      : { [ATTR.CODE_FILE_PATH]: script.filePath }),
  };
}

function longestScript(frame: TimedFrame | null): TimedScript | null {
  if (frame === null) return null;
  let best: TimedScript | null = null;
  for (const script of frame.scripts) {
    if (best === null || script.durationMs > best.durationMs) best = script;
  }
  return best;
}

function rememberFrames(
  frames: TimedFrame[],
  entries: readonly PerformanceEntry[]
): void {
  for (const entry of entries) {
    const frame = frameFromEntry(entry);
    if (frame === null) continue;
    frames.push(frame);
    if (frames.length > FRAME_LIMIT) frames.shift();
  }
}

function inputFromEntry(
  entry: PerformanceEntry,
  targetName: (target: EventTarget | null) => string | null
): TimedInput | null {
  const name = recordedType(entry.name);
  if (name === null || !Number.isFinite(entry.duration) || entry.duration <= 0)
    return null;
  const timing = entry as PerformanceEntry & {
    processingStart?: number;
    processingEnd?: number;
    target?: EventTarget | null;
  };
  return {
    name,
    startTimeMs: entry.startTime,
    durationMs: entry.duration,
    processingStartMs: timing.processingStart ?? entry.startTime,
    processingEndMs: timing.processingEnd ?? entry.startTime,
    target: targetName(timing.target ?? null),
  };
}

function frameFromEntry(entry: PerformanceEntry): TimedFrame | null {
  if (!Number.isFinite(entry.duration) || entry.duration <= 0) return null;
  const scripts = (
    entry as PerformanceEntry & {
      scripts?: readonly {
        sourceFunctionName?: string;
        sourceURL?: string;
        duration?: number;
      }[];
    }
  ).scripts;
  return {
    startTimeMs: entry.startTime,
    durationMs: entry.duration,
    scripts: (scripts ?? []).flatMap((script) => {
      const durationMs = script.duration ?? 0;
      if (!Number.isFinite(durationMs) || durationMs <= 0) return [];
      return [
        {
          functionName: script.sourceFunctionName ?? '',
          filePath: script.sourceURL ?? '',
          durationMs,
        },
      ];
    }),
  };
}

function recordedType(name: string): RecordedInteractionType | null {
  return RECORDED.has(name) ? (name as RecordedInteractionType) : null;
}

function elapsedMs(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value);
}

function readObserver(): ObserverCtor | undefined {
  const candidate = (globalThis as { PerformanceObserver?: ObserverCtor })
    .PerformanceObserver;
  return typeof candidate === 'function' ? candidate : undefined;
}

function observeFirst(
  Observer: ObserverCtor,
  types: readonly string[],
  onEntries: (entries: readonly PerformanceEntry[]) => void
): EntryObserver | null {
  for (const type of types) {
    try {
      const observer = new Observer((list) => {
        onEntries(list.getEntries());
      });
      const options =
        type === 'event' ? { type, durationThreshold: 16 } : { type };
      observer.observe(options);
      return observer;
    } catch {
      // This host has no entry of that type; try the next one.
    }
  }
  return null;
}
