import type {
  MatchmakingCapability,
  TurnGames,
} from '@pkgs/turn-game-shared-ts/game-rules';
import type { MultiplayerRatingPool, TimeControl } from './time-control';
import {
  DEFAULT_TIME_CONTROL,
  gameSpeed,
  TIME_CONTROLS,
  timeControlOf,
} from './time-control';

/** A real offered match, with a rating pool and an optional turn clock. */
export type MatchChoice = {
  readonly id: string;
  readonly ratingPool: MultiplayerRatingPool;
  readonly clock: TimeControl | null;
};

export function matchChoiceOf(
  id: string | null | undefined
): MatchChoice | null {
  if (id === null || id === undefined) return null;
  const clock = timeControlOf(id);
  if (clock !== null) return { id, ratingPool: clock.speed, clock };
  const parts = id.split('/');
  if (parts.length > 2 || parts.at(-1) !== 'play') return null;
  const namespace = parts.length === 2 ? `${parts[0]}/` : '';
  if (parts.length === 2 && parts[0] === '') return null;
  return { id, ratingPool: gameSpeed(namespace, 'game'), clock: null };
}

export function defaultMatchChoice(matched: MatchmakingCapability): string {
  return (
    matched.namespace +
    (matched.clockChoices === true ? DEFAULT_TIME_CONTROL : 'play')
  );
}

/** Timing is advertised independently of how the game executes. */
export function offeredMatchChoices(rules: TurnGames): readonly MatchChoice[] {
  return rules.games.flatMap((game) => {
    const matched = game.capabilities.matchmaking;
    if (matched === undefined) return [];
    const choices =
      matched.clockChoices === true
        ? TIME_CONTROLS.map((clock) => matched.namespace + clock.id)
        : [defaultMatchChoice(matched)];
    return choices.map((id) => matchChoiceOf(id)!);
  });
}
