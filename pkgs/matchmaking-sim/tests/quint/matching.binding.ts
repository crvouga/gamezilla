/**
 * `specs/matchmaking/matching.qnt` against matchmaking behind three entrances:
 * each model action through the matchmaking sim actions at the entrance the
 * trace drew, and each person's standing read back from every entrance (all
 * three must agree).
 */

import type { StatusResult } from '@pkgs/matchmaking/interface';
import {
  join,
  leave,
  matchmaking,
  NameAttr,
  participantIds,
  RatingAttr,
  ratingWithin,
  ready,
  statusAcrossReplicas,
  tick,
  updateFormulas,
} from '@pkgs/matchmaking-sim';
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
/** The model's reaches, in rating points. */
const REACH_POINTS: Readonly<Record<string, number>> = {
  Narrow: 5,
  Wide: 200,
};
const ENTRANCE_COUNT = 3;
/** A wait nobody ever started. */
const NOBODY = '00000000-0000-0000-0000-000000000000';

function person(picks: Picks): string {
  return String(picks['person']);
}

function reachPoints(picks: Picks): number {
  const tag = (picks['reach'] as { readonly tag: string }).tag;
  const points = REACH_POINTS[tag];
  if (points === undefined) throw new Error(`unknown reach ${tag}`);
  return points;
}

/** The entrance the trace drew (the model numbers them from 1). */
function at(picks: Picks): string {
  return `r${String(Number(picks['entrance']) - 1)}`;
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
      `entrances disagree on ${who}'s standing: ${JSON.stringify(seen)}`
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
      w.sim = await matchmaking.run({
        seed: w.ctx.testId,
        args: { replicas: ENTRANCE_COUNT },
      });
    },
    waitForMatch: async (w, picks) => {
      const s = traceMatchmaking(w);
      const who = person(picks);
      await s.apply(join, {
        ref: who,
        input: {
          data: { ...RatingAttr(RATING[who]!), ...NameAttr(who) },
          formulas: [ratingWithin(reachPoints(picks))],
        },
        replicaId: at(picks),
      });
      const id = (await s.read(participantIds))[who]!;
      w.waitedBy.set(id, who);
    },
    stopWaiting: async (w, picks) => {
      const s = traceMatchmaking(w);
      const who = person(picks);
      const waited = (await s.read(participantIds))[who] !== undefined;
      await s.apply(
        leave,
        waited
          ? { ref: who, replicaId: at(picks) }
          : { participantId: NOBODY, replicaId: at(picks) }
      );
    },
    changeReach: async (w, picks) => {
      await traceMatchmaking(w).apply(updateFormulas, {
        ref: person(picks),
        formulas: [ratingWithin(reachPoints(picks))],
        replicaId: at(picks),
      });
    },
    matchingRound: async (w, picks) => {
      await traceMatchmaking(w).apply(tick, { replicaId: at(picks) });
    },
    entranceOpensAgain: async (w, picks) => {
      await traceMatchmaking(w).apply(ready, { replicaId: at(picks) });
    },
  },
  observe: async (w) => {
    const standing = new Map<QuintValue, QuintValue>();
    for (const who of Object.keys(RATING)) {
      standing.set(who, await standingOf(w, who));
    }
    return { standing };
  },
});
