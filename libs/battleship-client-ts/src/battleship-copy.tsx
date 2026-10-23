import type { ShipId } from '@libs/battleship-shared-ts/battleship-board';
import type { Orientation } from '@libs/battleship-shared-ts/battleship-fleet';
import type { Shot } from '@libs/battleship-shared-ts/battleship-position';
import { t } from '@lingui/core/macro';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import type { PlacementRefusal } from './battleship-draft';

/** The column headers, A to J, and the row headers, 1 to 10. */
export const COLUMN_LABELS: readonly string[] = 'ABCDEFGHIJ'.split('');
export const ROW_LABELS: readonly string[] = Array.from(
  { length: 10 },
  (_, n) => String(n + 1)
);
/** What each mark shows; every cell's label says it in words too. */
export const GLYPHS = {
  ship: '■',
  miss: '•',
  hit: '✕',
  sunk: '✖',
  aiming: '◎',
  fits: '+',
  refused: '⊘',
} as const;

export function shipName(ship: ShipId): string {
  const names: Readonly<Record<ShipId, string>> = {
    carrier: t`Carrier`,
    battleship: t`Battleship`,
    cruiser: t`Cruiser`,
    submarine: t`Submarine`,
    destroyer: t`Destroyer`,
  };
  return names[ship];
}
export function sideName(side: GameSide): string {
  return side === 'white' ? t`Blue fleet` : t`Red fleet`;
}
export function orientationName(orientation: Orientation): string {
  return orientation === 'h' ? t`across` : t`down`;
}
export function refusalText(ship: ShipId, refusal: PlacementRefusal): string {
  const name = shipName(ship);
  if (refusal.kind === 'off-board')
    return t`The ${name} does not fit there: it would run off the board.`;
  const other = shipName(refusal.other);
  return t`The ${name} cannot go there: it would overlap the ${other}.`;
}
/** How the latest shot is announced: by you, or by a fleet by name. */
export function shotSentence(shot: Shot, shooter: string | null): string {
  const cell = shot.cell.toUpperCase();
  const ship = shot.ship === undefined ? '' : shipName(shot.ship);
  if (shooter === null) {
    const yours: Readonly<Record<Shot['outcome'], string>> = {
      miss: t`You fired at ${cell} and missed.`,
      hit: t`You fired at ${cell} and hit.`,
      sunk: t`You fired at ${cell} and sank the ${ship}.`,
    };
    return yours[shot.outcome];
  }
  const theirs: Readonly<Record<Shot['outcome'], string>> = {
    miss: t`${shooter} fired at ${cell} and missed.`,
    hit: t`${shooter} fired at ${cell} and hit.`,
    sunk: t`${shooter} fired at ${cell} and sank the ${ship}.`,
  };
  return theirs[shot.outcome];
}
/** Whose turn it is, or who won; `viewer` is `null` for a watcher. */
export function turnSentence(args: {
  readonly turn: GameSide;
  readonly winner: GameSide | null;
  readonly viewer: GameSide | null;
}): string {
  const winner = args.winner;
  if (winner !== null) {
    const name = sideName(winner);
    if (args.viewer === null) return t`${name} sank the whole fleet.`;
    return winner === args.viewer
      ? t`You sank the whole fleet. You win.`
      : t`${name} sank your whole fleet.`;
  }
  const turn = sideName(args.turn);
  if (args.viewer === null) return t`${turn} to fire.`;
  return args.turn === args.viewer
    ? t`Your turn to fire.`
    : t`${turn} is firing.`;
}
