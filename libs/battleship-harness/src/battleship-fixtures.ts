/**
 * Battleship's known examples, written from its own rules — never computed
 * by them. Blue's fleet lies along rows 1, 3, 5, 7 and 9 from column A; Red's
 * along rows 2, 4, 6, 8 and 10 from column F.
 */

/** Blue (the first fleet): carrier A1–E1, battleship A3–D3, cruiser A5–C5, submarine A7–C7, destroyer A9–B9. */
export const BLUE_FLEET =
  'fleet:carrier@a1h;battleship@a3h;cruiser@a5h;submarine@a7h;destroyer@a9h';
/** Red (the second fleet): carrier F2–J2, battleship F4–I4, cruiser F6–H6, submarine F8–H8, destroyer F10–G10. */
export const RED_FLEET =
  'fleet:carrier@f2h;battleship@f4h;cruiser@f6h;submarine@f8h;destroyer@f10h';

/** Blue's seventeen shots: every cell of Red's fleet, one ship at a time. */
const BLUE_SHOTS = [
  'f2',
  'g2',
  'h2',
  'i2',
  'j2',
  'f4',
  'g4',
  'h4',
  'i4',
  'f6',
  'g6',
  'h6',
  'f8',
  'g8',
  'h8',
  'f10',
  'g10',
] as const;
/** Red's sixteen shots in reply, all at empty water of Blue's board (rows 2 and 4). */
const RED_SHOTS = [
  'a2',
  'b2',
  'c2',
  'd2',
  'e2',
  'f2',
  'g2',
  'h2',
  'i2',
  'j2',
  'a4',
  'b4',
  'c4',
  'd4',
  'e4',
  'f4',
] as const;

/** Each ship of Red's fleet, by the shot that sinks it. */
const SINKS: Readonly<Record<string, string>> = {
  j2: 'carrier',
  i4: 'battleship',
  h6: 'cruiser',
  h8: 'submarine',
  g10: 'destroyer',
};

/** Blue's shots and Red's replies in turn, Blue's last sinking the fleet. */
export const BLUE_VICTORY: readonly string[] = BLUE_SHOTS.flatMap((shot, i) =>
  i < RED_SHOTS.length ? [shot, RED_SHOTS[i]!] : [shot]
);

const label = (cell: string, outcome: string) =>
  `${cell.toUpperCase()} ${outcome}`;

/** How the move list names each of those shots. */
export const BLUE_VICTORY_LABELS: readonly string[] = BLUE_SHOTS.flatMap(
  (shot, i) => {
    const blue =
      SINKS[shot] === undefined
        ? label(shot, 'hit')
        : `${shot.toUpperCase()} sinks the ${SINKS[shot]}`;
    return i < RED_SHOTS.length ? [blue, label(RED_SHOTS[i]!, 'miss')] : [blue];
  }
);

/** Each ship of Blue's fleet by the cells it covers. */
export const BLUE_SHIP_CELLS = {
  carrier: ['a1', 'b1', 'c1', 'd1', 'e1'],
  battleship: ['a3', 'b3', 'c3', 'd3'],
  cruiser: ['a5', 'b5', 'c5'],
  submarine: ['a7', 'b7', 'c7'],
  destroyer: ['a9', 'b9'],
} as const;
/** Each ship of Red's fleet by the cells it covers, in the order Blue sinks it. */
export const RED_SHIP_CELLS = {
  carrier: ['f2', 'g2', 'h2', 'i2', 'j2'],
  battleship: ['f4', 'g4', 'h4', 'i4'],
  cruiser: ['f6', 'g6', 'h6'],
  submarine: ['f8', 'g8', 'h8'],
  destroyer: ['f10', 'g10'],
} as const;

/**
 * Red's fleet with its destroyer on C3–C4 and nothing on H8, H9 or the
 * rest of columns C and H: carrier F2–J2, battleship F4–I4, cruiser F6–H6,
 * submarine A8–C8, destroyer C3–C4.
 */
export const RED_FLEET_DESTROYER_C3 =
  'fleet:carrier@f2h;battleship@f4h;cruiser@f6h;submarine@a8h;destroyer@c3v';

/** Blue's four ships but its destroyer: a fleet with a ship missing. */
export const BLUE_FOUR_SHIPS = [
  { ship: 'carrier', bow: 'a1', orientation: 'h' },
  { ship: 'battleship', bow: 'a3', orientation: 'h' },
  { ship: 'cruiser', bow: 'a5', orientation: 'h' },
  { ship: 'submarine', bow: 'a7', orientation: 'h' },
] as const;

/**
 * `shots` by the first fleet, each answered by the second fleet at empty
 * water of Blue's board, so the first fleet has the turn after them.
 */
export function answeredShots(shots: readonly string[]): readonly string[] {
  if (shots.length > RED_SHOTS.length)
    throw new Error('More shots than known replies');
  return shots.flatMap((shot, i) => [shot, RED_SHOTS[i]!]);
}

/** How the game names each side's fleet. */
export const SIDE_NAMES = { white: 'Blue fleet', black: 'Red fleet' } as const;

/** Each ship's length, as the rules give it. */
export const SHIP_LENGTHS = {
  carrier: 5,
  battleship: 4,
  cruiser: 3,
  submarine: 3,
  destroyer: 2,
} as const;

/** Every ship down a column from row 1: carrier J1–J5, battleship H1–H4, cruiser F1–F3, submarine D1–D3, destroyer B1–B2. */
export const VERTICAL_FLEET =
  'fleet:carrier@j1v;battleship@h1v;cruiser@f1v;submarine@d1v;destroyer@b1v';
