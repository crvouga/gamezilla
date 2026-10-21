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
