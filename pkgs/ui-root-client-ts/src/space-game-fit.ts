/**
 * How a game fits the people in a space, for its launcher tile. Pure, so
 * every head count is checked without rendering; the words live in
 * `SpaceLauncher`.
 */

import type { SpaceGamePlayers, SpaceRole } from './space-types';

export type SpaceGameFit =
  /** Playable now; `counts` says how many it takes. */
  | { kind: 'fits'; counts: readonly number[] }
  /** The host can fill the missing seats with bots (`4 · add 2 bots`). */
  | { kind: 'bots'; target: number; bots: number }
  /** Too few people and no bots for this viewer (`Needs 4`). */
  | { kind: 'needs'; target: number }
  /** More people than seats (`Up to 2`): the rest watch. */
  | { kind: 'tooMany'; max: number }
  /** A one-person game in a space of several (`Solo`): the rest watch. */
  | { kind: 'solo' };

/**
 * Whether the tile is dimmed: too few people are here to play it as they
 * are. More people than a game seats never dims it: the rest watch.
 */
export function spaceGameFitDimmed(fit: SpaceGameFit): boolean {
  return fit.kind === 'needs';
}

/**
 * The fit of a game for `present` people seen by `viewer`: only the host
 * fills seats with bots, so a guest sees a short game as `needs`.
 */
export function spaceGameFit(
  players: SpaceGamePlayers,
  present: number,
  viewer: SpaceRole
): SpaceGameFit {
  const counts = [...players.counts].sort((a, b) => a - b);
  const max = counts.at(-1) ?? 1;
  if (max === 1 && present > 1) return { kind: 'solo' };
  if (counts.includes(present)) return { kind: 'fits', counts };
  if (present > max) return { kind: 'tooMany', max };
  const target = counts.find((count) => count > present) ?? max;
  if (players.bots && viewer === 'host') {
    return { kind: 'bots', target, bots: target - present };
  }
  return { kind: 'needs', target };
}
