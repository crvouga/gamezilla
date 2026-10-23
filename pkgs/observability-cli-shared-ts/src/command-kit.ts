import type { IdentityResolver } from '@pkgs/observability-root-shared-ts/identity-resolver';
import type { PgStatsSource } from '@pkgs/observability-root-shared-ts/pg-stats';
import type {
  SearchOptions,
  TimeRange,
  TraceRef,
  TraceStore,
} from '@pkgs/observability-root-shared-ts/types';
import type { ObsArgs } from './args';
import { stringFlag } from './args';
import { emptyResult } from './empty-result';
import {
  FORMAT_HEADER,
  heading,
  narratedTrace,
  nextForTrace,
  traceLine,
} from './format';
import type { MutationCommandContext } from './mutation-chain';
import { resolveRange } from './time';

export type CommandResult = { readonly code: 0 | 1 | 2; readonly text: string };

export type Context = MutationCommandContext & {
  readonly identityResolver?: IdentityResolver;
  readonly nowMs: number;
  readonly pgStats?: PgStatsSource;
  readonly store: TraceStore;
};

/** Most traces a search reads under `--all`. */
const ALL_LIMIT = 1_000;

export function jsonResult(value: unknown): CommandResult {
  return {
    code: 0,
    text: JSON.stringify({ format: FORMAT_HEADER, data: value }, null, 2),
  };
}

export function rangeFor(
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

/**
 * Search options that remember when a search stopped early, so the output can
 * say so. `--all` raises the limit; without it the store applies its own.
 */
export function searching(args: ObsArgs): {
  readonly notes: string[];
  readonly options: SearchOptions;
} {
  const notes: string[] = [];
  return {
    notes,
    options: {
      ...(args.flags['all'] === true ? { limit: ALL_LIMIT } : {}),
      onTruncated(notice) {
        const why =
          notice.reason === 'limit'
            ? `stopped after ${notice.kept} traces`
            : `a one-second slice still held more than the store returns, kept ${notice.kept}`;
        notes.push(
          `${notice.search}: ${why}; narrow --window, or pass --all for up to ${ALL_LIMIT}`
        );
      },
    },
  };
}

export async function renderRefs(
  ctx: Context,
  args: ObsArgs,
  options: {
    readonly notes?: readonly string[];
    readonly refs: readonly TraceRef[];
    readonly range: TimeRange;
    /** What was searched for: an identifier, or a kind of activity. */
    readonly subject: string;
    readonly searched?: 'identifier' | 'activity';
  }
): Promise<CommandResult> {
  const { refs, range, subject } = options;
  const notes = options.notes ?? [];
  if (refs.length === 0) {
    return emptyResult({
      args,
      range,
      store: ctx.store,
      subject,
      window: '24h',
      searched: options.searched ?? 'identifier',
    });
  }
  if (args.flags['json'] === true)
    return jsonResult({ range, traces: refs, truncations: notes });
  const ordered = [...refs].sort(
    (a, b) => b.errorCount - a.errorCount || b.startedAtMs - a.startedAtMs
  );
  const lines = [heading(ctx.store, range), ...ordered.map(traceLine)];
  lines.push(...notes.map((note) => `WARNING truncated: ${note}`));
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
