import { describe, expect, test } from 'bun:test';
import type { BattleshipSide } from '@libs/battleship-shared-ts/battleship-position';
import { decodeBattleshipPosition } from '@libs/battleship-shared-ts/battleship-position';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import {
  occupancy,
  other,
  playOut,
  point,
  randomChooser,
  rules,
  type Step,
  seededFleets,
  setupRules,
  TRANSFORMS,
  token,
  transformFleet,
} from './battleship-oracle';

const games = fc.record({
  seed: fc.integer({ min: 0, max: 1_000_000 }),
  plies: fc.integer({ min: 0, max: 200 }),
});
function drawnGame(drawn: { readonly seed: number; readonly plies: number }) {
  const fleets = seededFleets(String(drawn.seed));
  const choose = randomChooser(String(drawn.seed));
  return { fleets, ...playOut(fleets, choose, drawn.plies) };
}
const cellOf = (action: string) => action.split(':')[0]!;
/** The cells each attacker has hit after each step, by an independent tally. */
function hitTally(
  steps: readonly Step[],
  fleets: Record<BattleshipSide, string>
) {
  const hit = { white: new Set<string>(), black: new Set<string>() };
  return steps.map((step) => {
    if (occupancy(fleets[other(step.mover)]).has(step.proposal))
      hit[step.mover].add(step.proposal);
    return new Set(hit[step.mover]);
  });
}

describe('combat properties', () => {
  // regression: battleship-nightly-repeated-parsing
  test('P-007 a side never shoots the same cell twice', () =>
    assertProperty(
      'shot uniqueness',
      fc.property(games, (drawn) => {
        const { steps } = drawnGame(drawn);
        for (const side of ['white', 'black'] as const) {
          const cells = steps
            .filter((step) => step.mover === side)
            .map((step) => cellOf(step.action));
          expect(new Set(cells).size).toBe(cells.length);
        }
        const fired = { white: [] as string[], black: [] as string[] };
        const offeredAgain: string[] = [];
        for (const step of steps) {
          const legal = new Set(rules.legal(step.before));
          for (const cell of fired[step.mover])
            if (legal.has(cell)) offeredAgain.push(cell);
          const last = fired[step.mover].at(-1);
          if (last !== undefined)
            expect(rules.play(step.before, `${last}:miss`, '', [])).toBeNull();
          fired[step.mover].push(step.proposal);
        }
        expect(offeredAgain).toEqual([]);
      })
    ));
  test('P-008 accepted shots that do not finish the game alternate the turn', () =>
    assertProperty(
      'turn alternation',
      fc.property(games, (drawn) => {
        for (const [ply, step] of drawnGame(drawn).steps.entries()) {
          expect(decodeBattleshipPosition(step.before).turn).toBe(
            ply % 2 === 0 ? 'white' : 'black'
          );
          if (step.played.winner === null)
            expect(step.played.turn).toBe(other(step.mover));
        }
      })
    ));
  test('P-010 P-011 hits are exactly the defender fleet cells', () =>
    assertProperty(
      'hit and miss correctness',
      fc.property(games, (drawn) => {
        const { steps, fleets } = drawnGame(drawn);
        for (const step of steps) {
          const occupied = occupancy(fleets[other(step.mover)]);
          expect(cellOf(step.action)).toBe(step.proposal);
          expect(step.action.endsWith(':miss')).toBe(
            !occupied.has(step.proposal)
          );
        }
      })
    ));
  test('P-012 a ship sinks exactly when its last cell is hit', () =>
    assertProperty(
      'sinking correctness',
      fc.property(games, (drawn) => {
        const { steps, fleets } = drawnGame(drawn);
        const tally = hitTally(steps, fleets);
        for (const [ply, step] of steps.entries()) {
          const occupied = occupancy(fleets[other(step.mover)]);
          const ship = occupied.get(step.proposal);
          const whole =
            ship !== undefined &&
            [...occupied]
              .filter(([, id]) => id === ship)
              .every(([cell]) => tally[ply]!.has(cell));
          expect(step.action).toBe(
            ship === undefined
              ? `${step.proposal}:miss`
              : whole
                ? `${step.proposal}:sunk:${ship}`
                : `${step.proposal}:hit`
          );
        }
      })
    ));
  test('P-013 the attacker wins exactly when all 17 fleet cells are hit', () =>
    assertProperty(
      'victory correctness',
      fc.property(games, (drawn) => {
        const { steps, fleets } = drawnGame(drawn);
        const tally = hitTally(steps, fleets);
        for (const [ply, step] of steps.entries()) {
          const all = tally[ply]!.size === 17;
          expect(step.played.winner).toBe(all ? step.mover : null);
          expect(step.played.reason).toBe(all ? 'fleet sunk' : null);
        }
        if (steps.length < drawn.plies)
          expect(steps.at(-1)?.played.winner).not.toBeNull();
      })
    ));
  test('P-014 a finished game accepts no shot and offers none', () =>
    assertProperty(
      'terminal finality',
      fc.property(games, (drawn) => {
        const { position, fleets, steps } = drawnGame(drawn);
        if (steps.at(-1)?.played.winner == null) return;
        expect(rules.legal(position)).toEqual([]);
        for (const cell of ['a1', 'e5', 'j10']) {
          expect(setupRules.resolve(position, cell, fleets)).toBeNull();
          for (const outcome of ['miss', 'hit'])
            expect(rules.play(position, `${cell}:${outcome}`, '', [])).toBe(
              null
            );
        }
      })
    ));
  test('P-015 shots are only ever added', () =>
    assertProperty(
      'damage monotonicity',
      fc.property(games, (drawn) => {
        for (const step of drawnGame(drawn).steps) {
          const before = decodeBattleshipPosition(step.before).shots;
          const after = decodeBattleshipPosition(step.played.position).shots;
          expect([...after[other(step.mover)]]).toEqual([
            ...before[other(step.mover)],
          ]);
          expect(after[step.mover].slice(0, -1)).toEqual([
            ...before[step.mover],
          ]);
          expect(after[step.mover]).toHaveLength(before[step.mover].length + 1);
        }
      })
    ));
  test('P-016 the same fleets and shots give the same game', () =>
    assertProperty(
      'determinism',
      fc.property(games, (drawn) => {
        expect(drawnGame(drawn)).toEqual(drawnGame(drawn));
      })
    ));
  test('P-017 replaying the actions reproduces every position and label', () =>
    assertProperty(
      'replay equivalence',
      fc.property(games, (drawn) => {
        const { steps, actions, position } = drawnGame(drawn);
        expect(rules.replay(actions, 0)).toBe(rules.initial());
        for (const [ply, step] of steps.entries())
          expect(rules.replay(actions, ply + 1)).toBe(step.played.position);
        expect(
          rules.moves(position, '', actions).map((move) => move.label)
        ).toEqual(steps.map((step) => step.played.label));
        expect(rules.recognizes(position)).toBe(true);
      })
    ));
});

describe('P-025 symmetry', () => {
  test('a transformed board gives the transformed outcomes', () =>
    assertProperty(
      'board symmetry',
      fc.property(
        games,
        fc.constantFrom(...Object.keys(TRANSFORMS)),
        (drawn, name) => {
          const transform = TRANSFORMS[name]!;
          const moved = (cell: string) => token(transform(point(cell)));
          const original = drawnGame(drawn);
          const fleets = {
            white: transformFleet(original.fleets.white, transform),
            black: transformFleet(original.fleets.black, transform),
          };
          expect(setupRules.accept(fleets.white)).toBe(fleets.white);
          expect(setupRules.accept(fleets.black)).toBe(fleets.black);
          const proposals = original.steps.map((step) => step.proposal);
          const mirrored = playOut(
            fleets,
            () => {
              const next = proposals.shift();
              return next === undefined ? null : moved(next);
            },
            drawn.plies
          );
          expect(mirrored.actions).toEqual(
            original.actions.map((action) =>
              action.replace(/^[a-j]\d+/, (cell) => moved(cell))
            )
          );
        }
      )
    ));
});
