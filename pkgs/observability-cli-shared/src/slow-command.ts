import { ATTR } from '@pkgs/observability-root-shared/attributes';
import type { NarrateSpan } from '@pkgs/observability-root-shared/narrate';
import type {
  TimeRange,
  TraceRef,
} from '@pkgs/observability-root-shared/types';
import type { ObsArgs } from './args';
import { stringFlag } from './args';
import type { CommandResult, Context } from './command-kit';
import { jsonResult, rangeFor, renderRefs, searching } from './command-kit';
import { heading } from './format';
import { HELP } from './help';
import { percentile } from './percentile';

export async function slow(
  ctx: Context,
  args: ObsArgs
): Promise<CommandResult> {
  const range = rangeFor(args, ctx.nowMs, '1h');
  if (range === undefined) return { code: 2, text: HELP };
  const search = searching(args);
  let refs = await ctx.store.recent(range, search.options);
  const layer = stringFlag(args, 'layer');
  if (layer !== undefined && !isLayer(layer)) {
    return { code: 2, text: `${HELP}\ninvalid --layer ${layer}` };
  }
  if (layer === 'db')
    return slowDatabase(ctx, args, { refs, range, notes: search.notes });
  if (layer !== undefined) {
    refs = await refsForLayer(ctx, refs, layer);
  }
  const requested = Number(stringFlag(args, 'p') ?? '95');
  const threshold = percentile(
    refs.map((ref) => ref.durationMs),
    requested
  );
  return renderRefs(ctx, args, {
    refs: refs.filter((ref) => ref.durationMs >= threshold),
    range,
    notes: search.notes,
    searched: 'activity',
    subject: `p${requested} latency traces`,
  });
}

function isLayer(value: string): value is 'client' | 'worker' | 'db' {
  return value === 'client' || value === 'worker' || value === 'db';
}

async function slowDatabase(
  ctx: Context,
  args: ObsArgs,
  found: {
    readonly notes: readonly string[];
    readonly range: TimeRange;
    readonly refs: readonly TraceRef[];
  }
): Promise<CommandResult> {
  const { refs, range } = found;
  const selected = await refsForLayer(ctx, refs, 'db');
  const requested = Number(stringFlag(args, 'p') ?? '95');
  const threshold = percentile(
    selected.map((ref) => ref.durationMs),
    requested
  );
  const slowRefs = selected.filter((ref) => ref.durationMs >= threshold);
  const stats = await ctx.pgStats?.slowest(10);
  if (args.flags['json'] === true) {
    return jsonResult({ range, pgStats: stats ?? null, traces: slowRefs });
  }
  const pgLines =
    stats === undefined
      ? [
          'pg-stat-statements: unavailable (set OBS_READONLY_DATABASE_URL)',
          'trace-span fallback:',
        ]
      : stats.available
        ? [
            `pg-stat-statements: ${stats.statements.length} cumulative statements, ranked by mean execution time (not limited to the selected UTC range)`,
            ...stats.statements.flatMap((item) => [
              `${item.meanExecMs.toFixed(2)}ms mean | ${item.calls} calls | query ${item.queryId} | ${item.query.replace(/\s+/g, ' ').trim()}`,
              ...(item.exampleTraceId === undefined
                ? []
                : [
                    `  example: bun obs trace ${item.exampleTraceId} --source prod`,
                  ]),
            ]),
            'trace-span fallback:',
          ]
        : [`pg-stat-statements: ${stats.note}`, 'trace-span fallback:'];
  const traceResult = await renderRefs(ctx, args, {
    refs: slowRefs,
    range,
    notes: found.notes,
    searched: 'activity',
    subject: `p${requested} database latency traces`,
  });
  const hasStats = stats?.available === true && stats.statements.length > 0;
  return {
    code: hasStats ? 0 : traceResult.code,
    text: `${heading(ctx.store, range)}\n${pgLines.join('\n')}\n${traceResult.text.split('\n').slice(3).join('\n')}`,
  };
}

async function refsForLayer(
  ctx: Context,
  refs: readonly TraceRef[],
  layer: 'client' | 'worker' | 'db'
): Promise<TraceRef[]> {
  const selected: TraceRef[] = [];
  for (const ref of refs) {
    const trace = await ctx.store.getTrace(ref.traceId);
    const spans =
      trace?.spans.filter((item) => spanLayer(item) === layer) ?? [];
    if (spans.length === 0) continue;
    const slowest = [...spans].sort(
      (a, b) =>
        b.durationMs - a.durationMs ||
        (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
    )[0];
    if (slowest === undefined) continue;
    selected.push({
      ...ref,
      durationMs: slowest.durationMs,
      errorCount: spans.filter((item) => item.status === 'error').length,
      rootName: slowest.name,
      spanCount: spans.length,
      startedAtMs: Math.min(...spans.map((item) => item.startTimeMs)),
    });
  }
  return selected;
}

function spanLayer(span: NarrateSpan): 'client' | 'worker' | 'db' | undefined {
  if (span.attributes[ATTR.DB_SYSTEM_NAME] !== undefined) return 'db';
  const service = String(span.attributes[ATTR.SERVICE_NAME] ?? '');
  if (/client|browser/.test(service)) return 'client';
  if (/worker|server|api/.test(service)) return 'worker';
  return undefined;
}
