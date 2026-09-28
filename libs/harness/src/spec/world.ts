/**
 * The World a product scenario runs in: one harness per scenario, opened before
 * the first step and disposed after the last, with every harness call recorded
 * so a failure names what the world was asked to do.
 */

import { type ScenarioContext, setWorld } from '@pkgs/gherkin/registry';
import type { Run } from '@pkgs/harness';
import type { OpenHarnessOptions } from '../open-harness/mode';
import type { OpenHarness } from '../open-harness/open-harness';

export type HarnessWorld = {
  /** The run. Steps call `s.apply` / `s.read` / `s.until` on it. */
  readonly s: OpenHarness;
  readonly ctx: ScenarioContext;
  /** Values a step hands to a later step (a space link, an account id). */
  readonly memo: Map<string, unknown>;
  readonly calls: string[];
};

const ARG_PREVIEW_MAX = 60;

function preview(value: unknown): string {
  if (typeof value === 'function') {
    const source = value.name.length > 0 ? value.name : value.toString();
    return source.replace(/\s+/g, ' ').slice(0, ARG_PREVIEW_MAX);
  }
  const text = JSON.stringify(value);
  return text.length > ARG_PREVIEW_MAX
    ? `${text.slice(0, ARG_PREVIEW_MAX)}…`
    : text;
}

function nameOf(fn: unknown): string {
  if (typeof fn !== 'function') return String(fn);
  return fn.name.length > 0 ? fn.name : preview(fn);
}

/** `s` with `apply` / `read` / `until` / `never` / `advanceTime` recorded. */
export function recordingRun(s: OpenHarness, calls: string[]): OpenHarness {
  const recorded: OpenHarness = {
    ...s,
    apply: (action, ...args) => {
      calls.push(
        `apply ${(action as { readonly name: string }).name}(${args.map(preview).join(', ')})`
      );
      return s.apply(action, ...args);
    },
    read: (read, ...args) => {
      calls.push(`read ${nameOf(read)}(${args.map(preview).join(', ')})`);
      return s.read(read, ...args);
    },
    until: (read, opts) => {
      const detail = [
        opts?.maxMs === undefined ? '' : `maxMs: ${String(opts.maxMs)}`,
        opts?.pred === undefined ? '' : `pred: ${preview(opts.pred)}`,
      ]
        .filter((part) => part.length > 0)
        .join(', ');
      calls.push(
        `until ${nameOf(read)}${detail.length > 0 ? ` { ${detail} }` : ''}`
      );
      return s.until(read, opts);
    },
    never: (read, opts) => {
      calls.push(`never ${nameOf(read)} { forMs: ${String(opts.forMs)} }`);
      return s.never(read, opts);
    },
    advanceTime: (ms) => {
      calls.push(`advanceTime(${String(ms)})`);
      return s.advanceTime(ms);
    },
    [Symbol.asyncDispose]: () => s[Symbol.asyncDispose](),
  };
  return recorded;
}

/**
 * Memo key of the account a step signed `actor` into, for a later step that
 * checks they are still (or no longer) in it.
 */
export function signedInAccountKey(actor: string): string {
  return `signed-in-account:${actor}`;
}

/** Remember a value for a later step. */
export function remember<T>(w: HarnessWorld, key: string, value: T): T {
  w.memo.set(key, value);
  return value;
}

/** Recall a value an earlier step remembered; fails loudly when missing. */
export function recall(w: HarnessWorld, key: string): unknown {
  if (!w.memo.has(key)) {
    throw new Error(`no earlier step remembered "${key}"`);
  }
  return w.memo.get(key);
}

/** Opens the package's composition (`tests/harness/open-<feature>-harness.ts`). */
export type OpenPackageHarness = (
  testId: string,
  options?: OpenHarnessOptions
) => Promise<OpenHarness>;

/**
 * Register the harness world for this package's features. Each scenario's report
 * is named after the scenario and points at its feature line, and each step
 * is one labelled report step holding the harness calls it made. `extend` adds
 * what steps shared with a non-harness host need (e.g. the critical journeys'
 * `journey` host) to every scenario's world.
 */
export function useHarnessWorld(
  openHarness: OpenPackageHarness,
  extend: (world: HarnessWorld) => object = () => ({})
): void {
  setWorld<HarnessWorld>({
    create: async (ctx) => {
      const calls: string[] = [];
      const opened = await openHarness(ctx.testId, {
        report: {
          title: `${ctx.featureName}: ${ctx.scenarioName}`,
          sourceFile: ctx.featureUri,
          sourceLine: ctx.scenarioLine,
        },
      });
      const world: HarnessWorld = {
        s: recordingRun(opened, calls),
        ctx,
        memo: new Map(),
        calls,
      };
      return { ...world, ...extend(world) };
    },
    dispose: (w) => w.s[Symbol.asyncDispose](),
    calls: (w) => w.calls,
    record: (w, step, fn) =>
      w.s.record(
        {
          kind: step.keyword.trim(),
          title: `${step.keyword.trim()} ${step.text}`,
        },
        fn
      ),
  });
}

export type { Run };
