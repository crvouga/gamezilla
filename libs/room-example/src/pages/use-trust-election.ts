import { computeTrustMap, type TrustVote } from '@gamezilla/room/trust';
import { useCallback, useMemo, useState } from 'react';
import {
  PEERS,
  type ElectionRanking,
  type PeerId,
  type PlaygroundSimulator,
} from '../simulator/playground';

function defaultRankings(): ElectionRanking {
  return {
    'player-x': ['player-o', 'server', 'player-x'],
    'player-o': ['player-x', 'server', 'player-o'],
    server: ['player-x', 'player-o', 'server'],
  };
}

function firstChoice(rankings: ElectionRanking, peerId: PeerId): PeerId {
  return rankings[peerId][0] ?? peerId;
}

export type TrustElectionControls = {
  rankings: ElectionRanking;
  projectedTrustMap: Record<PeerId, number>;
  history: Array<{ authority: PeerId; trustMap: Record<PeerId, number> }>;
  setTopChoice: (voter: PeerId, trustedPeer: PeerId) => void;
  applyElection: () => void;
  resetRankings: () => void;
};

export function useTrustElection(
  sim: PlaygroundSimulator,
  tick: number,
): TrustElectionControls {
  const [rankings, setRankings] = useState<ElectionRanking>(() => defaultRankings());
  const [history, setHistory] = useState<
    Array<{ authority: PeerId; trustMap: Record<PeerId, number> }>
  >([]);

  const projectedTrustMap = useMemo(() => {
    const votes: TrustVote[] = PEERS.map((from) => ({
      from,
      trustedPeer: firstChoice(rankings, from),
    }));
    const computed = computeTrustMap(votes, [...PEERS]);
    return {
      'player-x': computed['player-x'] ?? 1,
      'player-o': computed['player-o'] ?? 1,
      server: computed['server'] ?? 1,
    };
  }, [rankings, tick]);

  const setTopChoice = useCallback((voter: PeerId, trustedPeer: PeerId) => {
    setRankings((prev) => {
      const others = prev[voter].filter((p) => p !== trustedPeer);
      return { ...prev, [voter]: [trustedPeer, ...others] };
    });
  }, []);

  const applyElection = useCallback(() => {
    sim.applyElectionRankings(rankings);
    const trustMap = sim.getTrustMap();
    setHistory((prev) => [
      ...prev,
      { authority: sim.getCurrentAuthorityLabel(), trustMap },
    ]);
  }, [sim, rankings]);

  const resetRankings = useCallback(() => {
    setRankings(defaultRankings());
  }, []);

  return {
    rankings,
    projectedTrustMap,
    history,
    setTopChoice,
    applyElection,
    resetRankings,
  };
}
