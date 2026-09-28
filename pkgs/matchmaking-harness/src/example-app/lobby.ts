/**
 * The example app's lobby: named people wait for a rated match through the
 * matchmaking port. Each person has at most one wait at a time — asking
 * again while waiting is refused — and stops or changes only their own
 * wait. The person's current wait is the harness alias (`refs`) of their
 * name, so the port reads (`statusOf`) see the same wait.
 */

import { defineAction, type JsonValue } from '@pkgs/harness';
import type { Matchmaking } from '@pkgs/matchmaking/interface';
import type { MatchmakingHarness } from '../scenario/facade';
import { NameAttr, RatingAttr, ratingWithin } from './attrs';

/** Where a request lands: the named replica, or the first one. */
type At = { readonly replicaId?: string };

export type WaitForMatchSpec = At & {
  readonly person: string;
  readonly rating: number;
  /** The person's rating range, in points either side of their rating. */
  readonly range: number;
};

function portAt(s: MatchmakingHarness, at: At): Matchmaking {
  return at.replicaId === undefined ? s.mm : s.replica(at.replicaId).mm;
}

async function isWaiting(
  mm: Matchmaking,
  wait: string | undefined
): Promise<boolean> {
  if (wait === undefined) return false;
  return (await mm.status(wait))?.status === 'waiting';
}

/** A person waits for a match, unless they are already waiting. */
export const waitForMatch = defineAction({
  name: 'waitForMatch',
  pool: false,
  act: async (s: MatchmakingHarness, spec: WaitForMatchSpec) => {
    const mm = portAt(s, spec);
    if (await isWaiting(mm, s.refs.get(spec.person))) {
      s.last.wait = 'alreadyWaiting';
      return;
    }
    const { participantId } = await mm.join({
      data: { ...RatingAttr(spec.rating), ...NameAttr(spec.person) },
      formulas: [ratingWithin(spec.range)],
    });
    s.refs.set(spec.person, participantId);
    s.last.wait = 'waiting';
  },
});

/** A person stops waiting; someone with no wait has nothing to stop. */
export const stopWaiting = defineAction({
  name: 'stopWaiting',
  pool: false,
  act: async (
    s: MatchmakingHarness,
    spec: At & { readonly person: string }
  ) => {
    const wait = s.refs.get(spec.person);
    s.last.leave =
      wait === undefined
        ? { removed: false }
        : await portAt(s, spec).leave(wait);
  },
});

/** A person changes their rating range; it counts only while waiting. */
export const changeRange = defineAction({
  name: 'changeRange',
  pool: false,
  act: async (
    s: MatchmakingHarness,
    spec: At & { readonly person: string; readonly range: number }
  ) => {
    const wait = s.refs.get(spec.person);
    s.last.update =
      wait === undefined
        ? { updated: false }
        : await portAt(s, spec).updateFormulas(wait, [
            ratingWithin(spec.range),
          ]);
  },
});

/** How the lobby answered the last person asking to wait. */
export function lastWait(s: MatchmakingHarness): JsonValue {
  return s.last.wait;
}

export const LOBBY_ACTIONS = [waitForMatch, stopWaiting, changeRange] as const;
