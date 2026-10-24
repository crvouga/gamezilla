import { describe, expect, test } from 'bun:test';
import {
  decodeQuoridor,
  encodeQuoridor,
  legalQuoridorActions,
  newQuoridor,
  pawnMoves,
  playQuoridor,
  quoridorCell,
  quoridorCellName,
  quoridorDistance,
  replayQuoridor,
  wallRefusal,
} from '@libs/quoridor-shared-ts/quoridor';
import { chooseQuoridorAction } from '@libs/quoridor-shared-ts/quoridor-bot';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

describe('Quoridor spatial and serialization integrity', () => {
  test('cell codec is a bijection on the complete board', () => {
    assertProperty(
      'Quoridor cells round trip',
      fc.property(fc.integer({ min: 0, max: 80 }), (cell) => {
        expect(quoridorCell(quoridorCellName(cell))).toBe(cell);
      })
    );
    for (const invalid of ['', 'a0', 'j1', 'e10', 'E1', 'a01'])
      expect(quoridorCell(invalid)).toBeNull();
  });

  test('untrusted histories cannot invent a state or continue after a winner', () => {
    assertProperty(
      'Quoridor untrusted positions',
      fc.property(fc.string(), (position) => {
        let game: ReturnType<typeof decodeQuoridor>;
        try {
          game = decodeQuoridor(position);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          return;
        }
        expect(encodeQuoridor(game)).toBe(position);
        expect(new Set(game.pawns).size).toBe(game.pawns.length);
        expect(
          game.pawns.every((_, player) =>
            Number.isFinite(quoridorDistance(game, player))
          )
        ).toBe(true);
      })
    );
    for (const invalid of [
      'quoridor:2:classic:',
      'quoridor:1:classic:a9h',
      'quoridor:1:classic:e3',
      'quoridor:1:hill:e2,e2',
      'quoridor:1:classic:e2,',
    ])
      expect(() => decodeQuoridor(invalid)).toThrow();
  });

  test('jump geometry handles open, fenced, edge and occupied landings', () => {
    const game = { ...newQuoridor('classic'), pawns: [31, 40] };
    expect(pawnMoves(game)).toContain(49);
    expect(pawnMoves(game)).not.toContain(39);
    expect(pawnMoves({ ...game, walls: ['e5h'] })).toEqual(
      expect.arrayContaining([39, 41])
    );
    expect(pawnMoves({ ...game, pawns: [67, 76] })).toEqual(
      expect.arrayContaining([75, 77])
    );
    const hill = { ...newQuoridor('hill'), pawns: [22, 31, 40, 44] };
    expect(pawnMoves(hill)).toEqual(expect.arrayContaining([30, 32]));
    expect(pawnMoves(hill)).not.toContain(49);
  });

  test('wall segment intersections differ from legal endpoint adjacency', () => {
    const game = { ...newQuoridor('classic'), walls: ['c4h'] };
    expect(wallRefusal(game, 'c4h')).toBe('overlap');
    expect(wallRefusal(game, 'b4h')).toBe('overlap');
    expect(wallRefusal(game, 'd4h')).toBe('overlap');
    expect(wallRefusal(game, 'c4v')).toBe('crossing');
    expect(wallRefusal(game, 'e4h')).toBeNull();
    expect(wallRefusal(game, 'c5v')).toBeNull();
    expect(wallRefusal({ ...game, remaining: [0, 10] }, 'a1h')).toBe(
      'no-walls'
    );
  });

  test('closing the final route is refused for every required goal', () => {
    const classic = { ...newQuoridor('classic'), walls: ['d1h', 'c1v'] };
    expect(wallRefusal(classic, 'e1v')).toBe('blocks-path');
    const hill = { ...newQuoridor('hill'), walls: ['d4h', 'e5h', 'd5v'] };
    expect(wallRefusal(hill, 'e4v')).toBe('blocks-path');
  });

  test('every opening action preserves immutable state, paths, inventories and deterministic replay', () => {
    for (const mode of ['classic', 'hill'] as const) {
      const game = newQuoridor(mode);
      const before = JSON.stringify(game);
      for (const action of legalQuoridorActions(game)) {
        const next = playQuoridor(game, action)!;
        expect(next).not.toBeNull();
        expect(next).toEqual(playQuoridor(game, action)!);
        expect(decodeQuoridor(encodeQuoridor(next))).toEqual(next);
        expect(next.turn).toBe(1);
        expect(next.remaining.every((count) => count >= 0)).toBe(true);
        expect(
          next.remaining.reduce((a, b) => a + b, 0) + next.walls.length
        ).toBe(20);
        expect(new Set(next.pawns).size).toBe(next.pawns.length);
        expect(
          next.pawns.every((_, player) =>
            Number.isFinite(quoridorDistance(next, player))
          )
        ).toBe(true);
        expect(playQuoridor(game, action, 1)).toBeNull();
      }
      expect(JSON.stringify(game)).toBe(before);
    }
  });
});

test('classic and hill replay stop at their own objective', () => {
  const classic = [
    'e2',
    'd9',
    'e3',
    'd8',
    'e4',
    'd7',
    'e5',
    'd6',
    'e6',
    'd5',
    'e7',
    'd4',
    'e8',
    'd3',
    'e9',
  ];
  const hill = [
    'e2',
    'a4',
    'e8',
    'i4',
    'e3',
    'a3',
    'e7',
    'i3',
    'e4',
    'a2',
    'e6',
    'i2',
    'e5',
  ];
  for (const [mode, actions] of [
    ['classic', classic],
    ['hill', hill],
  ] as const) {
    const game = replayQuoridor(mode, actions);
    expect(game.winner).toBe(0);
    expect(legalQuoridorActions(game)).toEqual([]);
    expect(playQuoridor(game, 'a1h')).toBeNull();
    expect(chooseQuoridorAction(game, 'hard', () => 0)).toBeNull();
    expect(() => replayQuoridor(mode, [...actions, 'a1h'])).toThrow();
  }
});

test('bots choose legal deterministic actions and finish both modes', () => {
  // regression: quoridor-path-validation-cost
  for (const mode of ['classic', 'hill'] as const)
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      let game = newQuoridor(mode);
      for (let ply = 0; ply < 250 && game.winner === null; ply++) {
        const action = chooseQuoridorAction(game, difficulty, () => 0.25)!;
        expect(action).toBe(
          chooseQuoridorAction(game, difficulty, () => 0.25)!
        );
        const next = playQuoridor(game, action);
        expect(next).not.toBeNull();
        game = next!;
      }
      expect(game.winner).not.toBeNull();
    }
});
