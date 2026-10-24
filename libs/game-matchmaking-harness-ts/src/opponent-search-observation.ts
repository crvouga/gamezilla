import type { ProductHarness } from '@libs/harness-ts/harness';
import { multiplayerRefusalCode } from './multiplayer-commands';
import { opponentSearchPresentation } from './multiplayer-presentation';

// Normalize opaque rendered match ids by encounter order. A second match,
// even on another person's device, is 2 and cannot masquerade as the first.
const identities = new WeakMap<ProductHarness, Map<string, number>>();
const REASONS: Readonly<Record<string, string>> = {
  OFFLINE: 'connection needed',
  CHESS_ALREADY_LOOKING: 'already seeking',
  CHESS_NO_SEARCH: 'no search',
  limit_reached: 'finish first',
};

/** Visible searches, match identity, seats and ratings, plus command refusals. */
export async function opponentSearchObservation(
  s: ProductHarness,
  people: readonly string[]
) {
  const ids = identities.get(s) ?? new Map<string, number>();
  identities.set(s, ids);
  const seeking = new Map<string, boolean>();
  const playNumber = new Map<string, number>();
  const clockChoiceShown = new Map<string, boolean>();
  const opponentRating = new Map<string, string>();
  const oppositeSides = new Map<string, boolean>();
  const refusal = new Map<string, string>();
  for (const person of people) {
    const view = await opponentSearchPresentation(s, person);
    if (view.gameId !== null && !ids.has(view.gameId))
      ids.set(view.gameId, ids.size + 1);
    seeking.set(person, view.seeking);
    playNumber.set(person, view.gameId === null ? 0 : ids.get(view.gameId)!);
    clockChoiceShown.set(
      person,
      view.clockChoices.length > 0 ||
        view.whiteClock !== null ||
        view.blackClock !== null ||
        view.clockDetail !== null
    );
    opponentRating.set(
      person,
      /\((\d+\??)\)\s*$/.exec(view.opponent ?? '')?.[1] ?? ''
    );
    oppositeSides.set(
      person,
      view.nearSide !== null &&
        view.farSide !== null &&
        view.nearSide !== view.farSide &&
        view.nearPlayer !== view.farPlayer
    );
    const code = await multiplayerRefusalCode(s, person);
    refusal.set(
      person,
      code === null
        ? view.error?.includes('needs a connection') === true
          ? 'connection needed'
          : ''
        : (REASONS[code] ?? code)
    );
  }
  return {
    seeking,
    playNumber,
    clockChoiceShown,
    opponentRating,
    oppositeSides,
    refusal,
  };
}
