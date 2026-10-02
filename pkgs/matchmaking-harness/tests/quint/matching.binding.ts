import type { CurrentSearch, JoinResult } from '@pkgs/matchmaking/interface';
import {
  availability,
  changeRange,
  connectDevice,
  deviceConnected,
  deviceRange,
  deviceView,
  lastBegin,
  matchFingerprint,
  matchmaking,
  NameAttr,
  repeatBegin,
  repeatChange,
  restriction,
  stopWaiting,
  tick,
  timePasses,
  waitForMatch,
} from '@pkgs/matchmaking-harness';
import { type QuintValue, variant } from '@pkgs/quint/itf';
import { bindQuintModel, type Picks } from '@pkgs/quint/registry';
import { type MatchmakingTraceWorld, traceMatchmaking } from './world';

const RATINGS: Readonly<Record<string, number>> = {
  alice: 1000,
  bob: 1050,
  carol: 1100,
  dave: 1150,
};
const PLACES = ['phone', 'computer'] as const;

function device(picks: Picks): { person: string; place: string } {
  const value = picks['device'] as Record<string, QuintValue>;
  return { person: String(value['person']), place: String(value['place']) };
}

function at(w: MatchmakingTraceWorld, picks: Picks) {
  const replicaId = `r${String(w.requests % 3)}`;
  w.requests += 1;
  return { ...device(picks), replicaId };
}

function waitId(w: MatchmakingTraceWorld, who: string, number: number): string {
  return (
    w.waits.get(`${who}:${String(number)}`) ??
    `unaccepted:${who}:${String(number)}`
  );
}

async function begin(w: MatchmakingTraceWorld, picks: Picks): Promise<void> {
  const s = traceMatchmaking(w);
  const target = at(w, picks);
  const online = await s.read(deviceConnected, target);
  await s.apply(waitForMatch, {
    ...target,
    rating: RATINGS[target.person]!,
    range: Number(picks['points']),
    groupSize: Number(picks['groupSize']),
    pool: String(picks['pool']),
  });
  if (!online) return;
  const number = (w.begun.get(target.person) ?? 0) + 1;
  w.begun.set(target.person, number);
  const result = (await s.read(lastBegin)) as JoinResult;
  if (result.outcome !== 'started' || result.participantId === null) return;
  w.waits.set(`${target.person}:${String(number)}`, result.participantId);
  w.numbers.set(result.participantId, number);
}

function standing(view: CurrentSearch | null): QuintValue {
  const result = view?.result;
  if (result === null || result === undefined) return variant('NotWaiting');
  if (result.status === 'waiting') return variant('Waiting');
  return variant(
    'Matched',
    new Set(result.peers.map((peer) => String(peer.data[NameAttr.key])))
  );
}

async function observe(
  w: MatchmakingTraceWorld
): Promise<Record<string, QuintValue>> {
  const s = traceMatchmaking(w);
  const states = new Map<QuintValue, QuintValue>();
  const numbers = new Map<QuintValue, QuintValue>();
  const ranges = new Map<QuintValue, QuintValue>();
  for (const person of Object.keys(RATINGS))
    for (const place of PLACES) {
      const target = { person, place };
      const view = (await s.read(deviceView, target)) as CurrentSearch | null;
      states.set(target, standing(view));
      numbers.set(
        target,
        view === null ? 0 : w.numbers.get(view.participantId)!
      );
      ranges.set(target, await s.read(deviceRange, target));
    }
  return { standing: states, waitNumber: numbers, ratingRange: ranges };
}

bindQuintModel<MatchmakingTraceWorld>({
  model: 'matching',
  traces: 128,
  maxSteps: 160,
  inductiveInvariant: '_proof',
  actions: {
    init: async (w) => {
      w.harness = await matchmaking.run({
        seed: w.ctx.testId,
        args: { replicas: 3 },
      });
      for (const person of Object.keys(RATINGS))
        for (const place of PLACES)
          await traceMatchmaking(w).apply(connectDevice, {
            person,
            place,
            connected: true,
          });
    },
    waitForMatch: begin,
    repeatRequest: async (w, picks) =>
      traceMatchmaking(w).apply(repeatBegin, {
        ...at(w, picks),
        number: Number(picks['number']),
      }),
    stopWaiting: async (w, picks) => {
      const target = at(w, picks);
      await traceMatchmaking(w).apply(stopWaiting, {
        ...target,
        participantId: waitId(w, target.person, Number(picks['number'])),
      });
    },
    changeRange: async (w, picks) => {
      const target = at(w, picks);
      await traceMatchmaking(w).apply(changeRange, {
        ...target,
        participantId: waitId(w, target.person, Number(picks['number'])),
        range: Number(picks['points']),
      });
    },
    repeatRangeChange: async (w, picks) => {
      const target = at(w, picks);
      await traceMatchmaking(w).apply(repeatChange, {
        ...target,
        participantId: waitId(w, target.person, Number(picks['number'])),
      });
    },
    pairUp: async (w) =>
      traceMatchmaking(w).apply(tick, {
        replicaId: `r${String(w.requests++ % 3)}`,
      }),
    becomeUnavailable: async (w, picks) =>
      traceMatchmaking(w).apply(availability, {
        person: String(picks['person']),
        available: false,
      }),
    becomeAvailable: async (w, picks) =>
      traceMatchmaking(w).apply(availability, {
        person: String(picks['person']),
        available: true,
      }),
    secondsPass: async (w, picks) =>
      traceMatchmaking(w).apply(timePasses, Number(picks['seconds'])),
    restrictPair: async (w, picks) =>
      traceMatchmaking(w).apply(restriction, {
        person: String(picks['person']),
        other: String(picks['other']),
        restricted: true,
      }),
    allowPair: async (w, picks) =>
      traceMatchmaking(w).apply(restriction, {
        person: String(picks['person']),
        other: String(picks['other']),
        restricted: false,
      }),
    loseConnection: async (w, picks) =>
      traceMatchmaking(w).apply(connectDevice, {
        ...at(w, picks),
        connected: false,
      }),
    comeBackOnline: async (w, picks) =>
      traceMatchmaking(w).apply(connectDevice, {
        ...at(w, picks),
        connected: true,
      }),
  },
  observe,
  fingerprint: (w) => traceMatchmaking(w).read(matchFingerprint),
});
