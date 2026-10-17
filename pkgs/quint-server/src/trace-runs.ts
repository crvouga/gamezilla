/**
 * The runs of one model trace: once, or — when the host varies the model
 * (`defineTraceVariants`) — once per variant, each named for it so its test,
 * world and verdict are its own.
 */

import type { TraceContext, TraceVariant } from '@pkgs/quint-shared/registry';

/** One run of a trace: the only one, or the one for a variant of the model. */
export type TraceRun = { readonly variant?: TraceVariant };
export const ONCE: readonly TraceRun[] = [{}];

/** `ctx` for `run`: its test id and title name the variant. */
export function runContext(ctx: TraceContext, run: TraceRun): TraceContext {
  const variant = run.variant;
  if (variant === undefined) return ctx;
  return {
    ...ctx,
    variant,
    testId: `${ctx.testId}.${variant.id.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    title: `${ctx.title} [${variant.label}]`,
  };
}

/** A test name for `run`, naming its variant. */
export function runName(name: string, run: TraceRun): string {
  return run.variant === undefined ? name : `${name} [${run.variant.label}]`;
}

/** An obligation id for `run` (`trace:3 [chess]`), so each variant has its own. */
export function runObligation(id: string, run: TraceRun): string {
  return run.variant === undefined ? id : `${id} [${run.variant.id}]`;
}

/**
 * The runs trace `i` (0-based) is replayed for: every run when the trace is
 * in the cover (so each variant takes every bound action) or the model is
 * not varied; otherwise one, the variants taking the rest in turn.
 */
export function runsOfTrace(
  i: number,
  runs: readonly TraceRun[],
  cover: ReadonlySet<number>
): readonly TraceRun[] {
  return runs.length <= 1 || cover.has(i) ? runs : [runs[i % runs.length]!];
}
