import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import type { MultiplayerGame } from './game-state';

/** Durable seat columns are opaque identities, independent of a game's visual labels. */
export const MULTIPLAYER_SIDES = ['white', 'black', 'red', 'blue'] as const;
export type MultiplayerRoster = Pick<
  MultiplayerGame,
  'white_id' | 'black_id' | 'red_id' | 'blue_id'
>;

export function multiplayerOwner(
  game: MultiplayerRoster,
  side: GameSide
): string {
  return game[`${side}_id`] ?? '';
}

export function multiplayerSides(game: MultiplayerRoster): readonly GameSide[] {
  return MULTIPLAYER_SIDES.filter(
    (side) => multiplayerOwner(game, side).length > 0
  );
}

export function multiplayerPeople(game: MultiplayerRoster): readonly string[] {
  return multiplayerSides(game).map((side) => multiplayerOwner(game, side));
}

export function multiplayerSideOf(
  game: MultiplayerRoster,
  person: string
): GameSide | null {
  return (
    multiplayerSides(game).find(
      (side) => multiplayerOwner(game, side) === person
    ) ?? null
  );
}

export function multiplayerStoredClock(
  game: Pick<MultiplayerGame, 'white_ms' | 'black_ms' | 'red_ms' | 'blue_ms'>,
  side: GameSide
): number {
  return game[`${side}_ms`] ?? 0;
}

export function withMultiplayerClock(
  game: MultiplayerGame,
  side: GameSide,
  ms: number
): MultiplayerGame {
  return { ...game, [`${side}_ms`]: ms };
}

/** Consent is a set of actual participants; malformed stored consent grants none. */
export function multiplayerVotes(
  game: MultiplayerRoster,
  stored: string | null | undefined
): readonly string[] {
  if (!stored) return [];
  try {
    const value: unknown = JSON.parse(stored);
    return Array.isArray(value)
      ? [
          ...new Set(
            value.filter(
              (person): person is string =>
                typeof person === 'string' &&
                multiplayerPeople(game).includes(person)
            )
          ),
        ]
      : [];
  } catch {
    return [];
  }
}
