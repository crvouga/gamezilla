/**
 * The space's games as its game choice offers them: one tile per family,
 * the family's modes (Light Cycles Duel, Trio and Quad) chosen after it.
 * Pure, so every registry shape is checked without rendering.
 */

import type { GameTileMotif } from '@pkgs/ui-root-client-ts/game-tile';
import type { SpaceGameClient } from './games-registry-context';

/** One tile of the game choice: a game, or a family of several modes. */
export type SpaceGameFamily = {
  /** The family's id (`light-cycles`); a lone game's own id. */
  readonly family: string;
  readonly title: string;
  readonly motif: GameTileMotif;
  /** Every head count its modes seat, ascending and once each. */
  readonly counts: readonly number[];
  /** Bots can fill the seats people leave open, in some mode. */
  readonly bots: boolean;
  /** Its modes, in registry order; at least one. */
  readonly modes: readonly SpaceGameClient[];
};

/**
 * A mode sits under its family's tile only if its id begins with the
 * family's: harness bindings find the tile of `word-tiles-3` that way.
 */
function assertModeId(family: string, id: string): void {
  if (id !== family && !id.startsWith(`${family}-`))
    throw new Error(
      `${id}: a mode of the ${family} family needs an id that begins with "${family}-"`
    );
}

function assertSameFamily(first: SpaceGameClient, mode: SpaceGameClient) {
  if (mode.familyTitle !== first.familyTitle)
    throw new Error(
      `${mode.id}: its familyTitle "${mode.familyTitle}" differs from ${first.id}'s "${first.familyTitle}" — every mode of ${first.family} names the family alike`
    );
  if (mode.motif !== first.motif)
    throw new Error(
      `${mode.id}: its tile differs from ${first.id}'s — every mode of ${first.family} shares the family's tile`
    );
}

function familyOf(modes: readonly SpaceGameClient[]): SpaceGameFamily {
  const [first] = modes;
  if (first === undefined) throw new Error('a game family has no mode');
  for (const mode of modes) {
    assertSameFamily(first, mode);
    if (modes.length > 1) assertModeId(first.family, mode.id);
  }
  const counts = [...new Set(modes.map((mode) => mode.players ?? 1))].sort(
    (a, b) => a - b
  );
  return {
    family: first.family,
    title: first.familyTitle,
    motif: first.motif,
    counts,
    bots: modes.some((mode) => mode.bots),
    modes,
  };
}

/** The registry's games grouped by family, in order of first appearance. */
export function spaceGameFamilies(
  games: readonly SpaceGameClient[]
): readonly SpaceGameFamily[] {
  const byFamily = new Map<string, SpaceGameClient[]>();
  for (const game of games) {
    const modes = byFamily.get(game.family) ?? [];
    modes.push(game);
    byFamily.set(game.family, modes);
  }
  return [...byFamily.values()].map(familyOf);
}

/**
 * The mode a family's tile picks by itself: its only one. A family of
 * several opens its modes instead (`null`).
 */
export function soleMode(family: SpaceGameFamily): SpaceGameClient | null {
  return family.modes.length === 1 ? (family.modes[0] ?? null) : null;
}
