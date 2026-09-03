/**
 * Port-level match invariants (status observations only — no SQL).
 */

import { expect } from 'bun:test';
import type { Run } from '@pkgs/dst';
import type { StatusResult } from '../../interface/types';
import {
  type MatchmakingSurface,
  participantIds,
  statusAcrossReplicas,
  statusById,
  statuses,
} from '../../sim/scenario';
import { expectMatched } from './attrs';

export type MatchmakingRun = Run<MatchmakingSurface>;

/** Stable digest of every aliased participant's match outcome. */
export async function matchFingerprint(run: MatchmakingRun): Promise<string> {
  const ids = await run.observe(participantIds);
  const all = (await run.observe(statuses())) as Record<
    string,
    StatusResult | null
  >;
  const parts: string[] = [];
  for (const [ref, id] of Object.entries(ids)) {
    const st = all[ref] ?? null;
    if (st?.status !== 'matched') {
      parts.push(`${id}:waiting`);
      continue;
    }
    const matched = expectMatched(st);
    const peers = matched.peers
      .map((x) => x.participantId)
      .sort()
      .join(',');
    parts.push(`${id}:${matched.matchId}:${peers}`);
  }
  return parts.sort().join('|');
}

/** Every replica returns the same status for this participant. */
export async function assertStatusAgreesAcrossReplicas(
  run: MatchmakingRun,
  participantId: string
): Promise<StatusResult | null> {
  const byReplica = (await run.observe(
    statusAcrossReplicas(participantId)
  )) as Record<string, StatusResult | null>;
  const ids = Object.keys(byReplica);
  const firstId = ids[0];
  if (firstId === undefined) throw new Error('no replicas');
  const first = byReplica[firstId] ?? null;
  for (const id of ids.slice(1)) {
    expect(JSON.stringify(byReplica[id] ?? null)).toBe(JSON.stringify(first));
  }
  return first;
}

async function collectMatchGroups(
  run: MatchmakingRun,
  participantIds: readonly string[],
  groupSize: number
): Promise<{ byMatch: Map<string, Set<string>>; waiting: number }> {
  const byMatch = new Map<string, Set<string>>();
  let waiting = 0;
  for (const participantId of participantIds) {
    const st = await assertStatusAgreesAcrossReplicas(run, participantId);
    if (st === null) {
      throw new Error(`participant ${participantId} missing from all replicas`);
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
    set.add(participantId);
    for (const peer of matched.peers) set.add(peer.participantId);
  }
  return { byMatch, waiting };
}

/**
 * Matched participants form consistent groups: one matchId each, peer sets
 * agree, optional groupSize - 1 peers.
 */
export async function assertMatchInvariants(
  run: MatchmakingRun,
  participantIds: readonly string[],
  opts?: { readonly groupSize?: number }
): Promise<{ readonly matchCount: number; readonly waiting: number }> {
  const groupSize = opts?.groupSize ?? 2;
  const { byMatch, waiting } = await collectMatchGroups(
    run,
    participantIds,
    groupSize
  );
  for (const [matchId, members] of byMatch) {
    expect(members.size).toBe(groupSize);
    for (const id of members) {
      const st = expectMatched(await run.observe(statusById(id)));
      expect(st.matchId).toBe(matchId);
      expect(new Set([id, ...st.peers.map((x) => x.participantId)])).toEqual(
        members
      );
    }
  }
  return { matchCount: byMatch.size, waiting };
}
