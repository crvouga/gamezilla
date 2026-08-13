/**
 * Port-level match invariants (status reads only — no SQL).
 */

import { expect } from 'bun:test';
import type { StatusResult } from '../../interface/types';
import type { MatchmakingSimWorld, ParticipantHandle } from '../../sim/world';
import { expectMatched } from './attrs';

function statusEqual(a: StatusResult | null, b: StatusResult | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Every replica returns the same status for this participant. */
export async function assertStatusAgreesAcrossReplicas(
  world: MatchmakingSimWorld,
  participantId: string
): Promise<StatusResult | null> {
  const replicaIds = [...world.replicas.keys()];
  const firstId = replicaIds[0];
  if (firstId === undefined) throw new Error('no replicas');
  const first = await world.replica(firstId).mm.status(participantId);
  for (const id of replicaIds.slice(1)) {
    const st = await world.replica(id).mm.status(participantId);
    expect(statusEqual(st, first)).toBe(true);
  }
  return first;
}

/**
 * Matched participants form consistent groups: one matchId each, peer sets
 * agree, optional groupSize - 1 peers.
 */
export async function assertMatchInvariants(
  world: MatchmakingSimWorld,
  participants: readonly ParticipantHandle[],
  opts?: { readonly groupSize?: number }
): Promise<{ readonly matchCount: number; readonly waiting: number }> {
  const groupSize = opts?.groupSize ?? 2;
  const byMatch = new Map<string, Set<string>>();
  let waiting = 0;
  for (const p of participants) {
    const st = await assertStatusAgreesAcrossReplicas(world, p.participantId);
    if (st === null) {
      throw new Error(
        `participant ${p.participantId} missing from all replicas`
      );
    }
    if (st.status === 'waiting') {
      waiting += 1;
      continue;
    }
    const matched = expectMatched(st);
    expect(matched.peers).toHaveLength(groupSize - 1);
    let set = byMatch.get(matched.matchId);
    if (set === undefined) {
      set = new Set();
      byMatch.set(matched.matchId, set);
    }
    set.add(p.participantId);
    for (const peer of matched.peers) {
      set.add(peer.participantId);
    }
  }
  for (const [matchId, members] of byMatch) {
    expect(members.size).toBe(groupSize);
    for (const id of members) {
      const st = expectMatched(await world.mm.status(id));
      expect(st.matchId).toBe(matchId);
      expect(new Set([id, ...st.peers.map((x) => x.participantId)])).toEqual(
        members
      );
    }
  }
  return { matchCount: byMatch.size, waiting };
}
