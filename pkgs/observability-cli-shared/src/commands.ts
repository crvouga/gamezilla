import { ATTR } from '@pkgs/observability-root-shared/attributes';
import type {
  IdentityResolver,
  ResolvedIdentity,
} from '@pkgs/observability-root-shared/identity-resolver';
import type { NarrateSpan } from '@pkgs/observability-root-shared/narrate';
import type { PgStatsSource } from '@pkgs/observability-root-shared/pg-stats';
import type {
  TimeRange,
  TraceRef,
  TraceStore,
} from '@pkgs/observability-root-shared/types';
import type { ObsArgs } from './args';
import { stringFlag } from './args';
import { emptyResult } from './empty-result';
import {
  FORMAT_HEADER,
  heading,
  narratedTrace,
  nextForTrace,
  noResults,
  traceLine,
} from './format';
import { HELP } from './help';
import type { MutationCommandContext } from './mutation-chain';
import { mutationCommand } from './mutation-chain';
import { percentile } from './percentile';
import { personCommand } from './person-command';
import { resolveRange } from './time';

export type CommandResult = { readonly code: 0 | 1 | 2; readonly text: string };
type Context = MutationCommandContext & {
  readonly identityResolver?: IdentityResolver;
  readonly nowMs: number;
  readonly pgStats?: PgStatsSource;
  readonly store: TraceStore;
};

function jsonResult(value: unknown): CommandResult {
  return {
    code: 0,
    text: JSON.stringify({ format: FORMAT_HEADER, data: value }, null, 2),
  };
}

function rangeFor(
  args: ObsArgs,
  nowMs: number,
  defaultWindow: string
): TimeRange | undefined {
  return resolveRange(
    nowMs,
    stringFlag(args, 'window') ?? stringFlag(args, 'since') ?? defaultWindow,
    stringFlag(args, 'at')
  );
}

async function renderRefs(
  ctx: Context,
  args: ObsArgs,
  options: {
    readonly refs: readonly TraceRef[];
    readonly range: TimeRange;
    readonly subject: string;
  }
): Promise<CommandResult> {
  const { refs, range, subject } = options;
  if (refs.length === 0) {
    return emptyResult({
      args,
      range,
      store: ctx.store,
      subject,
      window: '24h',
    });
  }
  if (args.flags['json'] === true) return jsonResult({ range, traces: refs });
  const ordered = [...refs].sort(
    (a, b) => b.errorCount - a.errorCount || b.startedAtMs - a.startedAtMs
  );
  const lines = [heading(ctx.store, range), ...ordered.map(traceLine)];
  const firstError = ordered.find((ref) => ref.errorCount > 0);
  if (firstError !== undefined) {
    const trace = await ctx.store.getTrace(firstError.traceId);
    if (trace !== null)
      lines.push('', narratedTrace(trace), nextForTrace(trace));
  } else {
    lines.push(`next: bun obs trace ${ordered[0]?.traceId ?? ''}`);
  }
  return { code: 0, text: lines.join('\n') };
}

async function last(ctx: Context, args: ObsArgs): Promise<CommandResult> {
  const range = rangeFor(args, ctx.nowMs, '10m');
  if (range === undefined)
    return { code: 2, text: `${HELP}\ninvalid time range` };
  let refs = await ctx.store.recent(range);
  if (args.flags['errors'] === true)
    refs = refs.filter((ref) => ref.errorCount > 0);
  return renderRefs(ctx, args, { refs, range, subject: 'recent activity' });
}

async function find(ctx: Context, args: ObsArgs): Promise<CommandResult> {
  const identifier = args.operands[0];
  const range = rangeFor(args, ctx.nowMs, '24h');
  if (identifier === undefined || range === undefined)
    return { code: 2, text: HELP };
  const identity = await resolveIdentity(ctx, identifier);
  if (identifier.includes('@') && ctx.identityResolver === undefined) {
    return identityUnavailable();
  }
  if (identifier.includes('@') && identity === null) {
    return emptyResult({
      args,
      range,
      store: ctx.store,
      subject: 'identity',
      window: '7d',
    });
  }
  const match =
    identity === null
      ? await ctx.store.find(identifier, range)
      : {
          kind: 'user' as const,
          value: identity.userId,
          traces: await ctx.store.findByUser(identity.userId, range),
        };
  if (match === null) {
    return emptyResult({
      args,
      range,
      store: ctx.store,
      subject: identifier,
      window: '7d',
    });
  }
  if (args.flags['json'] === true) return jsonResult(match);
  const result = await renderRefs(ctx, args, {
    refs: match.traces,
    range,
    subject: identifier,
  });
  return {
    ...result,
    text: `${heading(ctx.store, range)}\nmatched-as: ${identity?.matchedAs ?? match.kind}${identity === null ? '' : ` -> user.id ${identity.userId}`} (${match.traces.length} traces)\n${result.text.split('\n').slice(3).join('\n')}`,
  };
}

function identityUnavailable(): CommandResult {
  return {
    code: 2,
    text: `${FORMAT_HEADER}\nidentity resolver unavailable; raw email is not sent to telemetry\nnext: set OBS_READONLY_DATABASE_URL to a SELECT-only database role`,
  };
}

function resolveIdentity(
  ctx: Context,
  identifier: string
): Promise<ResolvedIdentity | null> {
  return ctx.identityResolver?.resolve(identifier) ?? Promise.resolve(null);
}

async function trace(ctx: Context, args: ObsArgs): Promise<CommandResult> {
  const traceId = args.operands[0];
  if (traceId === undefined) return { code: 2, text: HELP };
  const found = await ctx.store.getTrace(traceId);
  if (found === null)
    return {
      code: 1,
      text: noResults(traceId, { source: ctx.store.source, window: '24h' }),
    };
  if (args.flags['json'] === true) return jsonResult(found);
  return {
    code: 0,
    text: `${heading(ctx.store)}\n${narratedTrace(found)}\n${nextForTrace(found)}`,
  };
}

async function span(ctx: Context, args: ObsArgs): Promise<CommandResult> {
  const [traceId, spanId] = args.operands;
  if (traceId === undefined || spanId === undefined)
    return { code: 2, text: HELP };
  const found = await ctx.store.getTrace(traceId);
  const item = found?.spans.find((candidate) => candidate.spanId === spanId);
  if (item === undefined)
    return {
      code: 1,
      text: noResults(`${traceId}/${spanId}`, {
        source: ctx.store.source,
        window: '24h',
      }),
    };
  if (args.flags['json'] === true) return jsonResult(item);
  const events =
    item.events?.map(
      (event) => `  ${event.name} ${JSON.stringify(event.attributes ?? {})}`
    ) ?? [];
  return {
    code: 0,
    text: [
      heading(ctx.store),
      `span: ${item.name}`,
      `trace-id: ${item.traceId}`,
      `span-id: ${item.spanId}`,
      `status: ${item.status}${item.statusMessage === undefined ? '' : ` (${item.statusMessage})`}`,
      `duration-ms: ${item.durationMs.toFixed(3)}`,
      `attributes: ${JSON.stringify(item.attributes, null, 2)}`,
      'events:',
      ...(events.length === 0 ? ['  (none)'] : events),
      `next: bun obs trace ${item.traceId}`,
    ].join('\n'),
  };
}

async function correlated(
  ctx: Context,
  args: ObsArgs,
  kind: 'test' | 'user'
): Promise<CommandResult> {
  const value = args.operands[0];
  const range = rangeFor(args, ctx.nowMs, '24h');
  if (value === undefined || range === undefined)
    return { code: 2, text: HELP };
  const identity = kind === 'user' ? await resolveIdentity(ctx, value) : null;
  if (
    kind === 'user' &&
    value.includes('@') &&
    ctx.identityResolver === undefined
  )
    return identityUnavailable();
  if (kind === 'user' && value.includes('@') && identity === null) {
    return {
      code: 1,
      text: noResults('identity', {
        source: ctx.store.source,
        window: '7d',
        range,
      }),
    };
  }
  let refs =
    kind === 'test'
      ? await ctx.store.findByTest(value)
      : await ctx.store.findByUser(identity?.userId ?? value, range);
  if (kind === 'test' && args.flags['last-failure'] === true) {
    refs = refs.filter((ref) => ref.errorCount > 0).slice(0, 1);
  }
  const result = await renderRefs(ctx, args, {
    refs,
    range,
    subject: `${kind} ${identity?.userId ?? value}`,
  });
  if (identity === null || args.flags['json'] === true) return result;
  return {
    ...result,
    text: `${heading(ctx.store, range)}\nmatched-as: ${identity.matchedAs} -> user.id ${identity.userId}\n${result.text.split('\n').slice(3).join('\n')}`,
  };
}

async function slow(ctx: Context, args: ObsArgs): Promise<CommandResult> {
  const range = rangeFor(args, ctx.nowMs, '1h');
  if (range === undefined) return { code: 2, text: HELP };
  let refs = await ctx.store.recent(range);
  const layer = stringFlag(args, 'layer');
  if (layer !== undefined && !isLayer(layer)) {
    return { code: 2, text: `${HELP}\ninvalid --layer ${layer}` };
  }
  if (layer === 'db') return slowDatabase(ctx, args, refs, range);
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
    subject: `p${requested} latency`,
  });
}

function isLayer(value: string): value is 'client' | 'worker' | 'db' {
  return value === 'client' || value === 'worker' || value === 'db';
}

async function slowDatabase(
  ctx: Context,
  args: ObsArgs,
  refs: readonly TraceRef[],
  range: TimeRange
): Promise<CommandResult> {
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
    subject: `p${requested} database latency`,
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

async function diff(ctx: Context, args: ObsArgs): Promise<CommandResult> {
  const [leftId, rightId] = args.operands;
  if (leftId === undefined || rightId === undefined)
    return { code: 2, text: HELP };
  const [left, right] = await Promise.all([
    ctx.store.getTrace(leftId),
    ctx.store.getTrace(rightId),
  ]);
  if (left === null || right === null)
    return {
      code: 1,
      text: noResults(`${leftId}/${rightId}`, {
        source: ctx.store.source,
        window: '24h',
      }),
    };
  const totals = (spans: readonly NarrateSpan[]) =>
    new Map(spans.map((item) => [item.name, item.durationMs]));
  const a = totals(left.spans);
  const b = totals(right.spans);
  const names = [...new Set([...a.keys(), ...b.keys()])].sort();
  const lines = names.map(
    (name) =>
      `${name}: ${(a.get(name) ?? 0).toFixed(1)}ms -> ${(b.get(name) ?? 0).toFixed(1)}ms`
  );
  return {
    code: 0,
    text: [
      heading(ctx.store),
      `diff: ${leftId} -> ${rightId}`,
      ...lines,
      `next: bun obs trace ${rightId}`,
    ].join('\n'),
  };
}

async function errors(ctx: Context, args: ObsArgs): Promise<CommandResult> {
  const range = rangeFor(args, ctx.nowMs, '1h');
  if (range === undefined) return { code: 2, text: HELP };
  const requestedUser = stringFlag(args, 'user');
  const resolved =
    requestedUser === undefined
      ? null
      : await resolveIdentity(ctx, requestedUser);
  if (
    requestedUser?.includes('@') === true &&
    ctx.identityResolver === undefined
  )
    return identityUnavailable();
  if (
    requestedUser !== undefined &&
    ctx.identityResolver !== undefined &&
    resolved === null
  )
    return emptyResult({
      args,
      range,
      store: ctx.store,
      subject: 'identity',
      window: '7d',
    });
  const candidates =
    requestedUser === undefined
      ? await ctx.store.recent(range)
      : await ctx.store.findByUser(resolved?.userId ?? requestedUser, range);
  const refs = candidates.filter((ref) => ref.errorCount > 0);
  return renderRefs(ctx, args, {
    refs,
    range,
    subject:
      requestedUser === undefined
        ? 'errors'
        : `errors for user ${resolved?.userId ?? requestedUser}`,
  });
}

async function tail(ctx: Context, args: ObsArgs): Promise<CommandResult> {
  const range = rangeFor(args, ctx.nowMs, '1m');
  if (range === undefined) return { code: 2, text: HELP };
  const requestedUser = stringFlag(args, 'user');
  let resolvedUser: ResolvedIdentity | null = null;
  if (requestedUser !== undefined) {
    resolvedUser = await resolveIdentity(ctx, requestedUser);
    if (requestedUser.includes('@') && ctx.identityResolver === undefined)
      return identityUnavailable();
  }
  const refs =
    requestedUser === undefined
      ? await ctx.store.recent(range)
      : await ctx.store.findByUser(
          resolvedUser?.userId ?? requestedUser,
          range
        );
  const result = await renderRefs(ctx, args, {
    refs,
    range,
    subject:
      requestedUser === undefined
        ? 'tail snapshot'
        : `user ${resolvedUser?.userId ?? requestedUser}`,
  });
  if (args.flags['json'] === true) return result;
  return {
    ...result,
    text: `${result.text}\ntail-mode: bounded snapshot; rerun to follow\nnext: bun obs tail${requestedUser === undefined ? '' : ` --user ${resolvedUser?.userId ?? requestedUser}`}`,
  };
}

async function schema(ctx: Context, args: ObsArgs): Promise<CommandResult> {
  const value = await ctx.store.schema();
  if (args.flags['json'] === true) return jsonResult(value);
  const list = (name: string, values: readonly string[]) =>
    `${name}:\n${values.map((item) => `  ${item}`).join('\n')}`;
  return {
    code: 0,
    text: [
      heading(ctx.store),
      list('spans', value.spanNames),
      list('events', value.eventNames),
      list('attributes', value.attributeNames),
      'next: bun obs last',
    ].join('\n'),
  };
}

export async function runCommand(
  ctx: Context,
  args: ObsArgs
): Promise<CommandResult> {
  if (args.command === 'last') return last(ctx, args);
  if (args.command === 'find') return find(ctx, args);
  if (args.command === 'trace') return trace(ctx, args);
  if (args.command === 'span') return span(ctx, args);
  if (args.command === 'mutation') return mutationCommand(ctx, args);
  if (args.command === 'test' || args.command === 'user')
    return correlated(ctx, args, args.command);
  if (args.command === 'errors') return errors(ctx, args);
  if (args.command === 'slow') return slow(ctx, args);
  if (args.command === 'schema') return schema(ctx, args);
  if (args.command === 'diff') return diff(ctx, args);
  if (args.command === 'person') return personCommand(ctx, args);
  if (args.command === 'tail') return tail(ctx, args);
  return { code: args.command === 'help' ? 0 : 2, text: HELP };
}
