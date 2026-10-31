import type { CustomGame } from '@libs/game-session-shared-ts/custom-game-state';

/**
 * Why a custom game being set up cannot start yet, first blocker first:
 * seats nobody holds, closed seats nobody may take, invitations nobody has
 * answered, then people who are not ready. Mirrors `customGameStartable`:
 * a game has no reason exactly when it can start.
 */
export type FrameStartReason =
  | { readonly kind: 'open-seats'; readonly count: number }
  | { readonly kind: 'incomplete'; readonly count: number }
  | { readonly kind: 'invitations'; readonly count: number }
  | { readonly kind: 'unready'; readonly count: number };

function countOf(game: CustomGame, kind: string): number {
  return game.sides.filter((side) => game[side].kind === kind).length;
}

/** The first thing keeping `game` from starting, `null` when it can start. */
export function frameStartReason(game: CustomGame): FrameStartReason | null {
  if (game.status !== 'configuring') return null;
  const open = countOf(game, 'open');
  if (open > 0) return { kind: 'open-seats', count: open };
  const closed = countOf(game, 'closed');
  if (closed > 0) return { kind: 'incomplete', count: closed };
  const invited = countOf(game, 'invitation');
  if (invited > 0) return { kind: 'invitations', count: invited };
  const unready = game.sides.filter(
    (side) => game[side].kind === 'person' && !game.ready.includes(side)
  ).length;
  if (unready > 0) return { kind: 'unready', count: unready };
  return null;
}
