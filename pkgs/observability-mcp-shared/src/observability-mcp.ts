import { narrate } from '@pkgs/observability-shared/narrate';
import type { TimeRange, TraceRef, TraceStore } from '@pkgs/observability-shared/types';

export type McpTextResult = {
  readonly content: [{ readonly type: 'text'; readonly text: string }];
  readonly isError?: boolean;
};

export type ObservabilityMcpTools = {
  find_user_activity(input: {
    readonly userId: string;
    readonly startMs: number;
    readonly endMs: number;
  }): Promise<McpTextResult>;
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

function refsText(
  source: string,
  label: string,
  refs: readonly TraceRef[]
): string {
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
    `next: get_trace ${refs[0]?.traceId ?? ''}`,
  ].join('\n');
}

export function createObservabilityMcpTools(
  store: TraceStore
): ObservabilityMcpTools {
  const getTrace = async (traceId: string): Promise<McpTextResult> => {
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
  };
  return {
    async find_user_activity(input) {
      const window: TimeRange = {
        startMs: input.startMs,
        endMs: input.endMs,
      };
      const refs = await store.findByUser(input.userId, window);
      return result(refsText(store.source, `user ${input.userId}`, refs));
    },
    async get_trace(input) {
      return getTrace(input.traceId);
    },
    async narrate_trace(input) {
      return getTrace(input.traceId);
    },
    async find_failing_test_trace(input) {
      const refs = (await store.findByTest(input.testId)).filter(
        (ref) => ref.errorCount > 0
      );
      return result(
        refsText(store.source, `failing test ${input.testId}`, refs)
      );
    },
  };
}
