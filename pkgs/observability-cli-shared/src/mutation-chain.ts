import { ATTR } from '@pkgs/observability-shared/attributes';
import type { MutationTraceIndex } from '@pkgs/observability-shared/mutation-trace-index';
import type {
  TimeRange,
  Trace,
  TraceStore,
} from '@pkgs/observability-shared/types';
import type { ObsArgs } from './args';
import { stringFlag } from './args';
import {
  FORMAT_HEADER,
  heading,
  narratedTrace,
  nextForTrace,
  noResults,
} from './format';
import { HELP } from './help';
import { resolveRange } from './time';

const MAX_CAUSAL_TRACES = 8;
const MAX_CAUSAL_LINKS_PER_TRACE = 16;
const MAX_DIRECT_MUTATION_TRACES = 4;

export type MutationCommandContext = {
  readonly mutationTraceIndex?: MutationTraceIndex;
  readonly nowMs: number;
  readonly store: TraceStore;
};

type CommandResult = { readonly code: 0 | 1 | 2; readonly text: string };
type MutationChain = {
  readonly traces: readonly Trace[];
  readonly missing: readonly PendingTrace[];
  readonly truncated: boolean;
};

type PendingTrace = {
  readonly traceId: string;
  readonly originTimeMs?: number;
  readonly reconnectTimeMs?: number;
};

function traceStart(trace: Trace): number {
  return Math.min(...trace.spans.map((item) => item.startTimeMs));
}

function traceEnd(trace: Trace): number {
  return Math.max(
    ...trace.spans.map((item) => item.startTimeMs + item.durationMs)
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function formatDuration(milliseconds: number): string {
  return milliseconds < 1_000
    ? `${milliseconds.toFixed(1)}ms`
    : `${(milliseconds / 1_000).toFixed(2)}s`;
}

function linkedTraces(traceValue: Trace, mutationId: string): PendingTrace[] {
  const linked: PendingTrace[] = [];
  for (const spanValue of traceValue.spans) {
    for (const link of spanValue.links?.slice(0, MAX_CAUSAL_LINKS_PER_TRACE) ??
      []) {
      const linkedMutation = link.attributes?.[ATTR.APP_MUTATION_ID];
      if (linkedMutation !== undefined && String(linkedMutation) !== mutationId)
        continue;
      const originTime = link.attributes?.[ATTR.APP_MUTATION_ORIGIN_TIME_MS];
      linked.push({
        traceId: link.traceId,
        reconnectTimeMs: spanValue.startTimeMs,
        ...(typeof originTime === 'number' && Number.isFinite(originTime)
          ? { originTimeMs: originTime }
          : {}),
      });
    }
  }
  return linked;
}

async function loadMutationChain(
  ctx: MutationCommandContext,
  mutationId: string
): Promise<MutationChain> {
  const refs = await ctx.store.findByMutation(mutationId);
  const durableIds =
    (await ctx.mutationTraceIndex?.findTraceIds(mutationId)) ?? [];
  const seedIds = [
    ...new Set([...refs.map((item) => item.traceId), ...durableIds]),
  ];
  const pending = seedIds
    .slice(0, MAX_DIRECT_MUTATION_TRACES)
    .map((traceId) => ({ traceId }));
  const scheduled = new Set(pending.map((item) => item.traceId));
  const missing: PendingTrace[] = [];
  const traces: Trace[] = [];
  let truncated = seedIds.length > MAX_DIRECT_MUTATION_TRACES;
  let fetched = 0;
  while (pending.length > 0 && fetched < MAX_CAUSAL_TRACES) {
    const requested = pending.shift();
    if (requested === undefined) break;
    fetched += 1;
    const found = await ctx.store.getTrace(requested.traceId);
    if (found === null) {
      missing.push(requested);
      continue;
    }
    traces.push(found);
    for (const linked of linkedTraces(found, mutationId)) {
      if (scheduled.has(linked.traceId)) continue;
      if (scheduled.size >= MAX_CAUSAL_TRACES) {
        truncated = true;
        continue;
      }
      scheduled.add(linked.traceId);
      pending.push(linked);
    }
  }
  if (pending.length > 0) truncated = true;
  traces.sort(
    (left, right) =>
      traceStart(left) - traceStart(right) ||
      compareText(left.traceId, right.traceId)
  );
  return { traces, missing, truncated };
}

function renderChain(
  ctx: MutationCommandContext,
  range: TimeRange,
  mutationId: string,
  chain: MutationChain
): CommandResult {
  const lines = [
    heading(ctx.store, range),
    `mutation: ${mutationId}`,
    `causal-chain: ${chain.traces.length} trace${chain.traces.length === 1 ? '' : 's'} (max ${MAX_CAUSAL_TRACES})`,
  ];
  const lineBudget = Math.max(
    8,
    Math.floor(64 / Math.max(1, chain.traces.length))
  );
  for (const [index, traceValue] of chain.traces.entries()) {
    const previous = chain.traces[index - 1];
    if (previous !== undefined) {
      const gap = Math.max(0, traceStart(traceValue) - traceEnd(previous));
      lines.push(
        '',
        `offline gap: ${formatDuration(gap)} (${previous.traceId} -> ${traceValue.traceId})`
      );
    }
    lines.push(
      '',
      `causal step ${index + 1}/${chain.traces.length}: ${traceValue.traceId}`,
      narratedTrace(traceValue, lineBudget)
    );
  }
  for (const missing of chain.missing) {
    lines.push('', `linked trace unavailable: ${missing.traceId}`);
    if (
      missing.originTimeMs !== undefined &&
      missing.reconnectTimeMs !== undefined
    ) {
      lines.push(
        `offline gap: ${formatDuration(Math.max(0, missing.reconnectTimeMs - missing.originTimeMs))} (origin trace unavailable -> reconnect)`
      );
    }
  }
  if (chain.truncated)
    lines.push(`causal traversal capped at ${MAX_CAUSAL_TRACES} traces`);
  const errorTrace = [...chain.traces]
    .reverse()
    .find((item) =>
      item.spans.some((spanValue) => spanValue.status === 'error')
    );
  const drilldown = errorTrace ?? chain.traces.at(-1);
  if (drilldown !== undefined) lines.push(nextForTrace(drilldown));
  return { code: 0, text: lines.join('\n') };
}

export async function mutationCommand(
  ctx: MutationCommandContext,
  args: ObsArgs
): Promise<CommandResult> {
  const mutationId = args.operands[0];
  const range = resolveRange(
    ctx.nowMs,
    stringFlag(args, 'window') ?? stringFlag(args, 'since') ?? '24h',
    stringFlag(args, 'at')
  );
  if (mutationId === undefined || range === undefined)
    return { code: 2, text: HELP };
  const chain = await loadMutationChain(ctx, mutationId);
  if (args.flags['json'] === true) {
    return {
      code: 0,
      text: JSON.stringify(
        { format: FORMAT_HEADER, data: { mutationId, ...chain } },
        null,
        2
      ),
    };
  }
  if (chain.traces.length === 0) {
    return {
      code: 1,
      text: noResults(`mutation ${mutationId}`, {
        source: ctx.store.source,
        window: '7d',
        range,
      }),
    };
  }
  return renderChain(ctx, range, mutationId, chain);
}
