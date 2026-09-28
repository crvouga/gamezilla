import type { Matchmaking } from '@pkgs/matchmaking/interface';
import type { MatchmakingHarness } from './facade';

/** Identifies a participant either by test alias or by raw id. */
export type ParticipantTarget = {
  readonly ref?: string;
  readonly participantId?: string;
  readonly replicaId?: string;
};

export function mmOf(s: MatchmakingHarness, replicaId?: string): Matchmaking {
  return replicaId === undefined ? s.mm : s.replica(replicaId).mm;
}

export function idOf(s: MatchmakingHarness, ref: string): string {
  const id = s.refs.get(ref);
  if (id === undefined) {
    throw new Error(`matchmaking surface: unknown participant ref ${ref}`);
  }
  return id;
}

export function targetId(
  s: MatchmakingHarness,
  target: ParticipantTarget
): string {
  if (target.participantId !== undefined) return target.participantId;
  if (target.ref !== undefined) return idOf(s, target.ref);
  throw new Error('matchmaking surface: target needs ref or participantId');
}
