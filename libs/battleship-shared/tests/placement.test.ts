import { describe, expect, test } from 'bun:test';
import { CELLS, SHIPS } from '@libs/battleship-shared/battleship-board';
import {
  fleetCells,
  parseFleet,
  shipAt,
} from '@libs/battleship-shared/battleship-fleet';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import { createSeededRng } from '@pkgs/uuid-shared/seeded-rng';
import fc from 'fast-check';
import {
  CANONICAL,
  LENGTHS,
  occupancy,
  type Point,
  point,
  setupRules,
  token,
} from './battleship-oracle';

const ROWS_FLEET =
  'fleet:carrier@a1h;battleship@a3h;cruiser@a5h;submarine@a7h;destroyer@a9h';
const accept = setupRules.accept;

/** Cells a ship of `length` would cover from `bow`, including off the board. */
function reach(bow: Point, across: boolean, length: number): Point[] {
  return Array.from({ length }, (_, n) => ({
    c: bow.c + (across ? n : 0),
    r: bow.r + (across ? 0 : n),
  }));
}
const onBoard = (p: Point) => p.c >= 0 && p.c < 10 && p.r >= 0 && p.r < 10;
/** The other ships at the first free horizontal slots, row-major. */
function fleetAround(ship: string, entry: string, taken: Point[]): string {
  const used = new Set(taken.filter(onBoard).map(token));
  const entries = new Map([[ship, entry]]);
  for (const other of CANONICAL.filter((id) => id !== ship))
    for (let r = 0; r < 10 && !entries.has(other); r++)
      for (let c = 0; c + LENGTHS[other]! <= 10 && !entries.has(other); c++) {
        const cells = reach({ c, r }, true, LENGTHS[other]!).map(token);
        if (cells.some((cell) => used.has(cell))) continue;
        for (const cell of cells) used.add(cell);
        entries.set(other, `${other}@${token({ c, r })}h`);
      }
  return `fleet:${CANONICAL.map((id) => entries.get(id)).join(';')}`;
}

describe('fleet placement', () => {
  test('every ship fits at every bow and orientation exactly when it stays on the board', () => {
    for (const ship of CANONICAL)
      for (const bow of CELLS)
        for (const across of [true, false]) {
          const cells = reach(point(bow), across, LENGTHS[ship]!);
          const entry = `${ship}@${bow}${across ? 'h' : 'v'}`;
          const setup = fleetAround(ship, entry, cells);
          const accepted = accept(setup);
          expect(accepted !== null).toBe(cells.every(onBoard));
          if (accepted !== null) expect(accepted).toBe(setup);
        }
  });
  test('ships hug every corner and edge', () => {
    const corners =
      'fleet:carrier@f1h;battleship@j7v;cruiser@a8v;submarine@e10h;destroyer@a1v';
    expect(accept(corners)).toBe(corners);
    const edges =
      'fleet:carrier@a6v;battleship@j1v;cruiser@d1h;submarine@g10h;destroyer@j6v';
    expect(accept(edges)).toBe(edges);
  });
  test('a ship beyond any edge is refused, one cell back it fits', () => {
    const middle = new Map([
      ['carrier', 'carrier@c3h'],
      ['battleship', 'battleship@c4h'],
      ['cruiser', 'cruiser@c5h'],
      ['submarine', 'submarine@c6h'],
      ['destroyer', 'destroyer@c7h'],
    ]);
    const withShip = (entry: string) =>
      `fleet:${CANONICAL.map((id) =>
        entry.startsWith(`${id}@`) ? entry : middle.get(id)
      ).join(';')}`;
    for (const [beyond, inside] of [
      ['carrier@g1h', 'carrier@f1h'],
      ['carrier@a7v', 'carrier@a6v'],
      ['destroyer@j1h', 'destroyer@i1h'],
      ['destroyer@a10v', 'destroyer@a9v'],
      ['battleship@j8v', 'battleship@j7v'],
      ['cruiser@i10h', 'cruiser@h10h'],
      ['cruiser@k1h', 'cruiser@h1h'],
      ['cruiser@a0h', 'cruiser@a1h'],
      ['cruiser@a11h', 'cruiser@a10h'],
    ] as const) {
      expect(accept(withShip(beyond))).toBeNull();
      expect(accept(withShip(inside))).toBe(withShip(inside));
    }
  });
  test('overlapping ships are refused, touching ones are not', () => {
    expect(
      accept(
        'fleet:carrier@a1h;battleship@c1v;cruiser@a5h;submarine@a7h;destroyer@a9h'
      )
    ).toBeNull();
    expect(
      accept(
        'fleet:carrier@a1h;battleship@a1v;cruiser@a5h;submarine@a7h;destroyer@a9h'
      )
    ).toBeNull();
    const stacked =
      'fleet:carrier@a1h;battleship@a2h;cruiser@a3h;submarine@a4h;destroyer@a5h';
    expect(accept(stacked)).toBe(stacked);
    const diagonal =
      'fleet:carrier@a1h;battleship@f2h;cruiser@j3v;submarine@g6h;destroyer@e7v';
    expect(accept(diagonal)).toBe(diagonal);
  });
  test('a fleet missing, repeating or inventing a ship is refused', () => {
    for (const setup of [
      'fleet:carrier@a1h;battleship@a3h;cruiser@a5h;submarine@a7h',
      'fleet:carrier@a1h;battleship@a3h;cruiser@a5h;cruiser@a7h;destroyer@a9h',
      'fleet:carrier@a1h;battleship@a3h;cruiser@a5h;submarine@a7h;destroyer@a9h;destroyer@a10h',
      'fleet:carrier@a1h;battleship@a3h;cruiser@a5h;submarine@a7h;patrol@a9h',
      'fleet:carrier@a1h;carrier@a3h;cruiser@a5h;submarine@a7h;destroyer@a9h',
    ])
      expect(accept(setup)).toBeNull();
  });
  test('anything but the exact spelling is refused', () => {
    for (const setup of [
      '',
      'fleet:',
      `${ROWS_FLEET};`,
      ` ${ROWS_FLEET}`,
      `${ROWS_FLEET} `,
      ROWS_FLEET.replace(';', '; '),
      ROWS_FLEET.toUpperCase(),
      ROWS_FLEET.replace('a1h', 'A1h'),
      ROWS_FLEET.replace('a1h', 'a1d'),
      ROWS_FLEET.replace('a1h', 'a01h'),
      ROWS_FLEET.replace('fleet:', 'fleet;'),
      ROWS_FLEET.replace('fleet:', ''),
      `${ROWS_FLEET}${'x'.repeat(200)}`,
      'x'.repeat(201),
    ])
      expect(accept(setup)).toBeNull();
  });
  test('the fleet is stored in canonical ship order', () => {
    expect(
      accept(
        'fleet:destroyer@a9h;submarine@a7h;cruiser@a5h;battleship@a3h;carrier@a1h'
      )
    ).toBe(ROWS_FLEET);
  });
  test('a parsed fleet names each ship with its cells from the bow', () => {
    const fleet = parseFleet(
      'fleet:carrier@a1v;battleship@c3h;cruiser@j8v;submarine@e10h;destroyer@i1h'
    )!;
    expect(fleet.map((ship) => [ship.ship, ship.cells])).toEqual([
      ['carrier', ['a1', 'a2', 'a3', 'a4', 'a5']],
      ['battleship', ['c3', 'd3', 'e3', 'f3']],
      ['cruiser', ['j8', 'j9', 'j10']],
      ['submarine', ['e10', 'f10', 'g10']],
      ['destroyer', ['i1', 'j1']],
    ]);
    expect(fleetCells(fleet)).toHaveLength(17);
    expect(shipAt(fleet, 'f3')?.ship).toBe('battleship');
    expect(shipAt(fleet, 'b1')).toBeNull();
    expect(SHIPS.map((ship): unknown => [ship.id, ship.length])).toEqual(
      Object.entries(LENGTHS)
    );
  });
});

describe('random fleets', () => {
  test('every drawn fleet is legal and covers 17 distinct cells', () =>
    assertProperty(
      'random fleets are legal',
      fc.property(fc.integer(), (seed) => {
        const setup = setupRules.random(createSeededRng(seed).random);
        expect(accept(setup)).toBe(setup);
        const cells = occupancy(setup);
        expect(cells.size).toBe(17);
        expect([...cells.keys()].every((cell) => CELLS.includes(cell))).toBe(
          true
        );
      }),
      { numRuns: 300 }
    ));
  test('extreme draws still give a legal fleet', () => {
    for (const draw of [0, 0.5, 0.999_999_9, 1, -1, Number.NaN]) {
      const setup = setupRules.random(() => draw);
      expect(accept(setup)).toBe(setup);
    }
  });
});
