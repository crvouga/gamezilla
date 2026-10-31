import type { CustomGame } from '@libs/game-session-shared-ts/custom-game-state';
import { useConnectedSpaceRoster } from '@libs/spaces-client-ts/use-connected-space-roster';
import { type Accessor, createMemo } from 'solid-js';

/** The people sitting at the game: everyone holding a side, never a bot. */
export function seatedPeople(game: CustomGame | null): ReadonlySet<string> {
  if (game === null) return new Set();
  return new Set(
    game.sides
      .map((side) => game[side])
      .filter((participant) => participant.kind === 'person')
      .map((participant) => participant.person)
  );
}

/**
 * Seam: how many people are watching the game, for the frame's watcher
 * count.
 *
 * Nothing records who watches a custom game, so the count is read from the
 * space: the people connected to it right now (`useConnectedSpaceRoster`,
 * one entry per person however many devices they use) minus the people
 * sitting at the game. Someone in the space looking at another screen
 * still counts. When games record their own watchers, replace the body
 * with that count; callers stay as they are. Logged in
 * `docs/ui-overhaul/DECISIONS.md`.
 */
export function useFrameWatcherCount(
  game: Accessor<CustomGame | null>
): Accessor<number> {
  const roster = useConnectedSpaceRoster();
  return createMemo(() => {
    const seated = seatedPeople(game());
    const watching = new Set(
      roster()
        .map((actor) => actor.id)
        .filter((person) => !seated.has(person))
    );
    return watching.size;
  });
}
