import type { PlayerModelState } from './player-model';
import type { SplitMix32State } from './rng';
import type { SessionState } from './session-model';

export type AssistantSnapshot = {
  readonly __brand: 'AssistantSnapshot';
  readonly data: string;
};

export type SnapshotV1 = {
  readonly v: 1;
  readonly signalSeq: number;
  readonly rng: SplitMix32State;
  readonly player: PlayerModelState;
  readonly session: {
    readonly lastUpdateAt: number;
    readonly budget: number;
    readonly lastPayloadAt: readonly (readonly [string, number])[];
    readonly lastIntentAt: readonly (readonly [string, number])[];
    readonly recentRefs: readonly string[];
  };
};

export function makeSnapshot(data: string): AssistantSnapshot {
  return { __brand: 'AssistantSnapshot', data };
}

export function snapshotData(snapshot: AssistantSnapshot): string {
  return snapshot.data;
}

export function serializeSnapshotV1(args: {
  signalSeq: number;
  rng: SplitMix32State;
  player: PlayerModelState;
  session: SessionState;
}): string {
  const body: SnapshotV1 = {
    v: 1,
    signalSeq: args.signalSeq,
    rng: args.rng,
    player: { ...args.player },
    session: {
      lastUpdateAt: args.session.lastUpdateAt,
      budget: args.session.budget,
      lastPayloadAt: [...args.session.lastPayloadAt.entries()],
      lastIntentAt: [...args.session.lastIntentAt.entries()],
      recentRefs: [...args.session.recentRefs],
    },
  };
  return JSON.stringify(body);
}

export function deserializeSnapshotV1(data: string): {
  signalSeq: number;
  rng: SplitMix32State;
  player: PlayerModelState;
  session: SessionState;
} {
  const parsed: unknown = JSON.parse(data);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as { v?: unknown }).v !== 1
  ) {
    throw new Error('AssistantSnapshot: unsupported or corrupt snapshot');
  }
  const o = parsed as SnapshotV1;
  const session: SessionState = {
    lastUpdateAt: o.session.lastUpdateAt,
    budget: o.session.budget,
    lastPayloadAt: new Map(o.session.lastPayloadAt),
    lastIntentAt: new Map(o.session.lastIntentAt),
    recentRefs: [...o.session.recentRefs],
  };
  return {
    signalSeq: o.signalSeq,
    rng: { ...o.rng },
    player: { ...o.player },
    session,
  };
}
