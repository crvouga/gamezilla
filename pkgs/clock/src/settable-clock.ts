import type { Clock } from './types';

export type SettableClockState = {
  readonly now: number;
  readonly frozen: boolean;
  readonly offsetMs: number;
};

/**
 * Clock a callee may move (set / advance / freeze) without touching its
 * injected source — the shape stateful test doubles (e.g. mockingbird
 * runtimes) take as `clock`. Moves are an offset over `source`.
 */
export type SettableClock = Clock & {
  readonly set: (epochMs: number) => void;
  readonly advance: (deltaMs: number) => void;
  readonly freeze: () => void;
  readonly unfreeze: () => void;
  readonly reset: () => void;
  readonly state: () => SettableClockState;
};

export function createSettableClock(source: Clock): SettableClock {
  let offsetMs = 0;
  let frozenAt: number | null = null;
  const now = () => frozenAt ?? source.now() + offsetMs;
  return {
    now,
    set: (epochMs) => {
      if (frozenAt !== null) frozenAt = epochMs;
      else offsetMs = epochMs - source.now();
    },
    advance: (deltaMs) => {
      if (frozenAt !== null) frozenAt += deltaMs;
      else offsetMs += deltaMs;
    },
    freeze: () => {
      frozenAt = now();
    },
    unfreeze: () => {
      if (frozenAt === null) return;
      offsetMs = frozenAt - source.now();
      frozenAt = null;
    },
    reset: () => {
      offsetMs = 0;
      frozenAt = null;
    },
    state: () => ({ now: now(), frozen: frozenAt !== null, offsetMs }),
  };
}
