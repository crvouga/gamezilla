import {
  decodePosition,
  type WordTilesPosition,
} from '@libs/word-tiles-shared-ts/word-tiles-position';
import {
  seatOf,
  seatSides,
  WORD_TILES_IDS,
  type WordTilesSeatCount,
} from '@libs/word-tiles-shared-ts/word-tiles-ruleset';
import { t } from '@lingui/core/macro';
import {
  type FramePlayerColor,
  type GameFrame,
  type GamePlayerName,
  standingsByScore,
} from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import type { JSX } from 'solid-js';
import { createWordTilesBoard } from './word-tiles-board';
import { seatName } from './word-tiles-panels';

/** Each seat's color, as its name says: amber, teal, violet and coral. */
const SEAT_COLORS: readonly FramePlayerColor[] = [2, 3, 4, 7];

/** The score (or rack count) of the seat on `side`, `null` without one. */
function seatFigure(
  figures: readonly number[] | undefined,
  side: GameSide
): number | null {
  const seat = seatOf(side, figures?.length ?? 0);
  return seat === null ? null : (figures?.[seat] ?? null);
}

/**
 * Whose turn it is, the bag, and the run of scoreless turns. The player is
 * named as the score chips name them; only an unnamed seat falls back to its
 * colour, and the viewer is told it is their turn.
 */
function tableStatus(
  position: WordTilesPosition,
  viewer: GameSide | null,
  nameOf: GamePlayerName
): string | null {
  if (position.ended !== null) return null;
  const side = seatSides(position.seats)[position.turn];
  // A blank resolved name counts as no name.
  const resolved = side === undefined ? '' : (nameOf(side)?.trim() ?? '');
  const name = resolved === '' ? null : resolved;
  const turn =
    side !== undefined && side === viewer
      ? t`Your turn`
      : t`${name ?? seatName(position.turn)} to play`;
  const bag = t`${position.bag} tiles in the bag`;
  const scoreless =
    position.scoreless > 0
      ? ` · ${t`${position.scoreless} of 6 scoreless turns`}`
      : '';
  return `${turn} · ${bag}${scoreless}`;
}

/**
 * Two, three or four players, each table size its own mode; beside each
 * seat its score, and the tiles on its rack.
 */
export function wordTilesFrame(
  seats: WordTilesSeatCount
): GameFrame<JSX.Element> {
  const sides = seatSides(seats);
  return {
    seatLayout: 'compact-rail',
    compactInset: 'narrow',
    drawOffers: true,
    players: { min: 2, max: 4, default: seats, modes: WORD_TILES_IDS },
    options: [],
    seats: {
      look: (side) => ({ color: SEAT_COLORS[seatOf(side, 4) ?? 0] ?? 1 }),
      stat: (position, side) => {
        const score = seatFigure(decodePosition(position)?.scores, side);
        return score === null
          ? null
          : { label: t`Score`, value: String(score) };
      },
      facts: (position, side) => {
        const tiles = seatFigure(decodePosition(position)?.racks, side);
        return tiles === null ? [] : [t`${tiles} tiles`];
      },
      out: () => false,
    },
    createBoard: createWordTilesBoard,
    turnStatus: (position, viewer, _committed, nameOf) => {
      const table = decodePosition(position);
      return table === null ? null : tableStatus(table, viewer, nameOf);
    },
    // The highest score wins; tied leaders share the win.
    result: (position, winner) => {
      const scores = decodePosition(position)?.scores;
      return {
        scoreLabel: t`Score`,
        standings: standingsByScore({
          winner,
          sides,
          score: (side) => seatFigure(scores, side) ?? 0,
          best: 'highest',
        }),
      };
    },
  };
}
