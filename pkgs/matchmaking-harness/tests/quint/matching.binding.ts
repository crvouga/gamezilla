/**
 * `specs/matchmaking/matching.qnt` against the example app's lobby behind
 * three replicas sharing one store: each model action through the lobby's
 * actions, landing at the replicas in turn (which replica serves a request
 * is nobody's choice, so the trace does not draw it), and each person's
 * standing read back from every replica (all three must agree).
 */

import type { StatusResult } from '@pkgs/matchmaking/interface';
import {
  changeRange,
  matchFingerprint,
  matchmaking,
  participantIds,
  statusAcrossReplicas,
  stopWaiting,
  tick,
  waitForMatch,
} from '@pkgs/matchmaking-harness';
import { type QuintValue, variant } from '@pkgs/quint/itf';
import { bindQuintModel, type Picks } from '@pkgs/quint/registry';
import { type MatchmakingTraceWorld, traceMatchmaking } from './world';

/** Each person's rating: two close pairs, far from each other. */
const RATING: Readonly<Record<string, number>> = {
  alice: 1000,
  bob: 1050,
  carol: 1500,
  dave: 1550,
};
/** The model's rating ranges, in rating points. */
const RANGE_POINTS: Readonly<Record<string, number>> = {
  Narrow: 5,
  Wide: 200,
};
const REPLICA_COUNT = 3;

function person(picks: Picks): string {
  return String(picks['person']);
}

function rangePoints(picks: Picks): number {
  const tag = (picks['ratingRange'] as { readonly tag: string }).tag;
  const points = RANGE_POINTS[tag];
  if (points === undefined) throw new Error(`unknown range ${tag}`);
  return points;
}

/** The next replica in turn. */
function nextReplica(w: MatchmakingTraceWorld): string {
  const at = w.requests % REPLICA_COUNT;
  w.requests += 1;
  return `r${String(at)}`;
}

async function standingOf(
  w: MatchmakingTraceWorld,
  who: string
): Promise<QuintValue> {
  const s = traceMatchmaking(w);
  const id = (await s.read(participantIds))[who];
  if (id === undefined) return variant('NotWaiting');
  const seen = (await s.read(statusAcrossReplicas, id)) as Record<
    string,
    StatusResult | null
  >;
  const views = Object.values(seen).map((one) => JSON.stringify(one));
  if (new Set(views).size !== 1) {
    throw new Error(
      `replicas disagree on ${who}'s standing: ${JSON.stringify(seen)}`
    );
  }
  const one = Object.values(seen)[0] ?? null;
  if (one === null) return variant('NotWaiting');
  if (one.status === 'waiting') return variant('Waiting');
  const peers = one.peers.map(
    (p) => w.waitedBy.get(p.participantId) ?? `unknown:${p.participantId}`
  );
  if (peers.length !== 1) {
    throw new Error(`${who} is matched with ${String(peers.length)} people`);
  }
  return variant('Matched', peers[0]!);
}

bindQuintModel<MatchmakingTraceWorld>({
  model: 'matching',
  traces: 64,
  maxSteps: 60,
  actions: {
    init: async (w) => {
      w.harness = await matchmaking.run({
        seed: w.ctx.testId,
        args: { replicas: REPLICA_COUNT },
      });
    },
    waitForMatch: async (w, picks) => {
      const s = traceMatchmaking(w);
      const who = person(picks);
      await s.apply(waitForMatch, {
        person: who,
        rating: RATING[who]!,
        range: rangePoints(picks),
        replicaId: nextReplica(w),
      });
      const id = (await s.read(participantIds))[who];
      if (id !== undefined) w.waitedBy.set(id, who);
    },
    stopWaiting: async (w, picks) => {
      await traceMatchmaking(w).apply(stopWaiting, {
        person: person(picks),
        replicaId: nextReplica(w),
      });
    },
    changeRange: async (w, picks) => {
      await traceMatchmaking(w).apply(changeRange, {
        person: person(picks),
        range: rangePoints(picks),
        replicaId: nextReplica(w),
      });
    },
    pairUp: async (w) => {
      await traceMatchmaking(w).apply(tick, { replicaId: nextReplica(w) });
    },
    _loseConnection: () => Promise.resolve(),
    _connectionReturns: () => Promise.resolve(),
  },
  observe: async (w) => {
    const standing = new Map<QuintValue, QuintValue>();
    for (const who of Object.keys(RATING)) {
      standing.set(who, await standingOf(w, who));
    }
    return { standing };
  },
  fingerprint: (w) => traceMatchmaking(w).read(matchFingerprint),
});
