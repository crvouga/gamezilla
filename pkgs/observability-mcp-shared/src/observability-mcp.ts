import {
  parseLocalClock,
  utcClock,
} from '@pkgs/observability-root-shared/local-clock';
import { narrate } from '@pkgs/observability-root-shared/narrate';
import { atText } from '@pkgs/observability-root-shared/person-time';
import { reportForAccounts } from '@pkgs/observability-root-shared/person-trouble';
import type {
  SearchOptions,
  TimeRange,
  TraceRef,
  TraceStore,
} from '@pkgs/observability-root-shared/types';

export type McpTextResult = {
  readonly content: [{ readonly type: 'text'; readonly text: string }];
  readonly isError?: boolean;
};

type Range = { readonly startMs: number; readonly endMs: number };

export type ObservabilityMcpTools = {
  find_user_activity(
    input: Range & { readonly userId: string }
  ): Promise<McpTextResult>;
  find_session_activity(
    input: Range & { readonly sessionId: string }
  ): Promise<McpTextResult>;
  find_device_activity(
    input: Range & { readonly deviceId: string }
  ): Promise<McpTextResult>;
  recent_activity(
    input: Range & { readonly errorsOnly?: boolean }
  ): Promise<McpTextResult>;
  person_timeline(
    input: Range & { readonly userId: string; readonly place?: string }
  ): Promise<McpTextResult>;
  get_trace(input: { readonly traceId: string }): Promise<McpTextResult>;
  narrate_trace(input: { readonly traceId: string }): Promise<McpTextResult>;
  find_failing_test_trace(input: {
    readonly testId: string;
  }): Promise<McpTextResult>;
};

function result(text: string, isError = false): McpTextResult {
  return {
    content: [{ type: 'text', text }],
    ...(isError ? { isError: true } : {}),
  };
}

/** Search options that remember a search which stopped before it saw every match. */
function searching(): {
  readonly notes: string[];
  readonly options: SearchOptions;
} {
  const notes: string[] = [];
  return {
    notes,
    options: {
      onTruncated: (notice) =>
        notes.push(
          `WARNING truncated: ${notice.search} stopped at ${String(notice.kept)} traces; narrow the UTC range`
        ),
    },
  };
}

function refsText(
  source: string,
  label: string,
  found: {
    readonly notes: readonly string[];
    readonly refs: readonly TraceRef[];
  }
): string {
  const { refs, notes } = found;
  if (refs.length === 0) {
    return [
      'obs-mcp/v1',
      `source: ${source}`,
      `No traces matched ${label}.`,
      'next: widen the UTC range or run bun obs last --window 24h',
    ].join('\n');
  }
  return [
    'obs-mcp/v1',
    `source: ${source}`,
    `matched: ${label} (${String(refs.length)} traces)`,
    ...refs.map(
      (ref) =>
        `${ref.errorCount > 0 ? 'ERROR' : 'ok'} ${ref.traceId} ${ref.rootName} ${ref.durationMs.toFixed(1)}ms`
    ),
    ...notes,
    `next: get_trace ${refs[0]?.traceId ?? ''}`,
  ].join('\n');
}

async function traceText(
  store: TraceStore,
  traceId: string
): Promise<McpTextResult> {
  const trace = await store.getTrace(traceId);
  if (trace === null) {
    return result(
      `obs-mcp/v1\nsource: ${store.source}\nNo trace ${traceId}.\nnext: run find_user_activity or widen the source window`,
      true
    );
  }
  const error = trace.spans.find((span) => span.status === 'error');
  return result(
    [
      'obs-mcp/v1',
      `source: ${store.source}`,
      narrate(trace.spans, { maxLines: 40 }),
      error === undefined
        ? `next: bun obs trace ${traceId} --json`
        : `next: bun obs span ${traceId} ${error.spanId}`,
    ].join('\n')
  );
}

async function personText(
  store: TraceStore,
  input: Range & { readonly userId: string; readonly place?: string }
): Promise<McpTextResult> {
  const instantMs = Math.floor((input.startMs + input.endMs) / 2);
  const clock = utcClock(instantMs);
  const report = await reportForAccounts(
    store,
    [{ userId: input.userId, matchedAs: 'user_id' }],
    {
      clock,
      name: input.userId,
      at: atText(instantMs, clock),
      nowMs: input.endMs,
      windowMs: Math.max(60_000, input.endMs - input.startMs),
      ...(input.place === undefined ? {} : { place: input.place }),
      rerun: (question) => personToolCall(input.userId, question, input.endMs),
    }
  );
  return result(report.text);
}

export function createObservabilityMcpTools(
  store: TraceStore
): ObservabilityMcpTools {
  const byIdentifier = async (
    label: string,
    search: (options: SearchOptions) => Promise<readonly TraceRef[]>
  ): Promise<McpTextResult> => {
    const searched = searching();
    const refs = await search(searched.options);
    return result(
      refsText(store.source, label, { refs, notes: searched.notes })
    );
  };
  return {
    find_user_activity: (input) =>
      byIdentifier(`user ${input.userId}`, (options) =>
        store.findByUser(input.userId, window(input), options)
      ),
    find_session_activity: (input) =>
      byIdentifier(`session ${input.sessionId}`, (options) =>
        store.findBySession(input.sessionId, window(input), options)
      ),
    find_device_activity: (input) =>
      byIdentifier(`device ${input.deviceId}`, (options) =>
        store.findByDevice(input.deviceId, window(input), options)
      ),
    recent_activity: (input) =>
      byIdentifier(
        input.errorsOnly === true ? 'error traces' : 'recent activity',
        (options) =>
          store.recent(window(input), {
            ...options,
            errorsOnly: input.errorsOnly === true,
          })
      ),
    person_timeline: (input) => personText(store, input),
    get_trace: (input) => traceText(store, input.traceId),
    narrate_trace: (input) => traceText(store, input.traceId),
    async find_failing_test_trace(input) {
      const refs = (await store.findByTest(input.testId)).filter(
        (ref) => ref.errorCount > 0
      );
      return result(
        refsText(store.source, `failing test ${input.testId}`, {
          refs,
          notes: [],
        })
      );
    },
  };
}

function window(input: Range): TimeRange {
  return { startMs: input.startMs, endMs: input.endMs };
}

/** The tool call that asks the same question again. */
function personToolCall(
  userId: string,
  question: { readonly at: string; readonly windowMs: number },
  nowMs: number
): string {
  const instantMs = parseLocalClock(question.at, nowMs)?.instantMs ?? nowMs;
  const half = Math.floor(question.windowMs / 2);
  return `person_timeline ${JSON.stringify({
    userId,
    startMs: instantMs - half,
    endMs: instantMs + half,
  })}`;
}
