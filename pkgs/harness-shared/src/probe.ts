import type { Action } from './effect';
import { memoRead, popMemoFrame, pushMemoFrame } from './memo';

export class ActionNotEnabled extends Error {
  readonly action: string;
  constructor(action: string) {
    super(`ActionNotEnabled: '${action}'`);
    this.name = 'ActionNotEnabled';
    this.action = action;
  }
}

export type ProbeResult =
  | { readonly enabled: false }
  | {
      readonly enabled: true;
      readonly weight: number;
      readonly args: readonly unknown[];
    };

/**
 * Probe an action: await enabled + weight (+ draw args when walk asks).
 * Never runs `act`. Shares a memo frame with other probes in the same step
 * when the caller wraps with pushMemoFrame.
 */
export async function probe<S>(
  action: Action<S, unknown[]>,
  surface: S,
  opts?: { readonly drawArgs?: boolean; readonly rng?: { next(): number } }
): Promise<ProbeResult> {
  const enabled = await action.enabled(surface);
  if (!enabled) return { enabled: false };
  const weight = await action.weight(surface);
  if (!(weight > 0)) return { enabled: false };

  let args: readonly unknown[] = [];
  if (opts?.drawArgs === true && action.sample !== undefined) {
    const rng = opts.rng;
    if (rng === undefined) {
      throw new Error('probe: drawArgs requires rng');
    }
    const gen = await action.sample(surface);
    args = gen(rng as never) as unknown as readonly unknown[];
    if (!Array.isArray(args)) {
      // Gen may return a single value or a tuple — normalize to args list.
      args = [args] as unknown as readonly unknown[];
    }
  }

  return { enabled: true, weight, args };
}

/** Resolve weight/enabled for every action under one shared memo frame. */
export async function probeAll<S>(
  actions: readonly Action<S, unknown[]>[],
  surface: S,
  drawArgs: boolean,
  rng: { next(): number; fork(name: string): { next(): number } }
): Promise<
  readonly {
    readonly action: Action<S, unknown[]>;
    readonly result: ProbeResult;
  }[]
> {
  pushMemoFrame();
  try {
    const out: {
      readonly action: Action<S, unknown[]>;
      readonly result: ProbeResult;
    }[] = [];
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i]!;
      const result = await probe(action, surface, {
        drawArgs,
        rng: rng.fork(`probe:${action.name}:${i}`),
      });
      out.push({ action, result });
    }
    return out;
  } finally {
    popMemoFrame();
  }
}

/** Helper for enabled/weight that go through memo when a frame is active. */
export async function readThroughMemo<A extends unknown[], T>(
  fn: (s: never, ...args: A) => T | Promise<T>,
  surface: unknown,
  ...args: A
): Promise<T> {
  return memoRead(fn, surface, args);
}
