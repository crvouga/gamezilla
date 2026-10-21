import { describe, expect, test } from 'bun:test';
import { decodeBattleshipPosition } from '@libs/battleship-shared/battleship-position';
import type { GameSetups } from '@pkgs/turn-game-shared/game-rules';
import { rules, setupRules } from './battleship-oracle';

/** Black's fleet lies along rows 1, 3, 5, 7 and 9 from column a. */
const ROWS =
  'fleet:carrier@a1h;battleship@a3h;cruiser@a5h;submarine@a7h;destroyer@a9h';
/** White's fleet stands in columns a to e from row 1. */
const COLUMNS =
  'fleet:carrier@a1v;battleship@b1v;cruiser@c1v;submarine@d1v;destroyer@e1v';
const FLEETS: GameSetups = { white: COLUMNS, black: ROWS };
/** White sinks black's whole fleet while black misses down columns j and i. */
const VICTORY = [
  'a1:hit',
  'j1:miss',
  'b1:hit',
  'j2:miss',
  'c1:hit',
  'j3:miss',
  'd1:hit',
  'j4:miss',
  'e1:sunk:carrier',
  'j5:miss',
  'a3:hit',
  'j6:miss',
  'b3:hit',
  'j7:miss',
  'c3:hit',
  'j8:miss',
  'd3:sunk:battleship',
  'j9:miss',
  'a5:hit',
  'j10:miss',
  'b5:hit',
  'i1:miss',
  'c5:sunk:cruiser',
  'i2:miss',
  'a7:hit',
  'i3:miss',
  'b7:hit',
  'i4:miss',
  'c7:sunk:submarine',
  'i5:miss',
  'a9:hit',
  'i6:miss',
  'b9:sunk:destroyer',
];
const at = (actions: readonly string[]) =>
  rules.replay(actions, actions.length);
const resolve = (actions: readonly string[], proposal: string) =>
  setupRules.resolve(at(actions), proposal, FLEETS);

describe('positions', () => {
  test('a game starts with no shots and white to fire at any of 100 cells', () => {
    const start = rules.initial();
    expect(start).toBe('bs:1:');
    expect(rules.recognizes(start)).toBe(true);
    const legal = rules.legal(start);
    expect(legal).toHaveLength(100);
    expect(legal.slice(0, 11)).toEqual([
      ...['a1', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'h1', 'i1', 'j1'],
      'a2',
    ]);
    expect(legal.at(-1)).toBe('j10');
    expect(decodeBattleshipPosition(start)).toEqual({
      actions: [],
      shots: { white: [], black: [] },
      turn: 'white',
      winner: null,
    });
  });
  test('only well-formed shot logs are recognized', () => {
    for (const position of ['bs:1:a1:miss', 'bs:1:a1:hit,a1:miss'])
      expect(rules.recognizes(position)).toBe(true);
    for (const position of [
      '',
      'bs:1',
      'bs:2:',
      'c4:1:',
      'bs:1:,',
      'bs:1:a1',
      'bs:1:a1:miss,',
      'bs:1:a1:miss,b1:miss,a1:hit',
      'bs:1:k1:miss',
      'bs:1:a1:sunk:carrier',
      'bs:1: a1:miss',
    ])
      expect(rules.recognizes(position)).toBe(false);
  });
});

describe('resolving shots against the hidden fleet', () => {
  test('open water is a miss and a ship cell is a hit', () => {
    expect(resolve([], 'j10')).toBe('j10:miss');
    expect(resolve([], 'a2')).toBe('a2:miss');
    expect(resolve([], 'c3')).toBe('c3:hit');
    expect(resolve(['j10:miss'], 'e1')).toBe('e1:hit');
    expect(resolve(['j10:miss'], 'f1')).toBe('f1:miss');
  });
  test('the last cell of each ship sinks it, in any firing order', () => {
    const lines: readonly (readonly [string, readonly string[]])[] = [
      ['carrier', ['c1', 'a1', 'e1', 'b1', 'd1']],
      ['battleship', ['a3', 'b3', 'c3', 'd3']],
      ['cruiser', ['c5', 'b5', 'a5']],
      ['submarine', ['b7', 'a7', 'c7']],
      ['destroyer', ['b9', 'a9']],
    ];
    for (const [ship, cells] of lines) {
      const actions: string[] = [];
      for (const [index, cell] of cells.entries()) {
        const last = index === cells.length - 1;
        const action = resolve(actions, cell);
        expect(action).toBe(last ? `${cell}:sunk:${ship}` : `${cell}:hit`);
        actions.push(action!, `j${index + 1}:miss`);
      }
    }
  });
  test('a damaged ship stays afloat', () => {
    const actions = ['a1:hit', 'j1:miss', 'b1:hit', 'j2:miss', 'c1:hit'];
    actions.push('j3:miss', 'd1:hit', 'j4:miss');
    actions.forEach((action, ply) =>
      expect(resolve(actions.slice(0, ply), action.split(':')[0]!)).toBe(action)
    );
    const battle = decodeBattleshipPosition(at(actions));
    expect(battle.shots.white.every((shot) => shot.outcome === 'hit')).toBe(
      true
    );
    expect(battle.winner).toBeNull();
    expect(resolve(actions, 'e1')).toBe('e1:sunk:carrier');
  });
  test('a repeated, foreign or off-board cell is refused', () => {
    expect(resolve(['a1:hit', 'j1:miss'], 'a1')).toBeNull();
    expect(resolve(['a1:hit'], 'a1')).toBe('a1:hit');
    for (const proposal of ['k1', 'a0', 'a11', 'A1', 'a1 ', '', 'a1:hit'])
      expect(resolve([], proposal)).toBeNull();
  });
  test('a defender without a legal fleet resolves nothing', () => {
    const start = rules.initial();
    expect(
      setupRules.resolve(start, 'a1', { white: COLUMNS, black: 'fleet:' })
    ).toBeNull();
    expect(
      setupRules.resolve(start, 'a1', { white: 'fleet:', black: ROWS })
    ).toBe('a1:hit');
  });
});

describe('playing resolved shots', () => {
  test('the turn passes after a miss and after a hit', () => {
    const miss = rules.play(rules.initial(), 'j10:miss', '', [])!;
    expect([miss.turn, miss.label, miss.winner]).toEqual([
      'black',
      'J10 miss',
      null,
    ]);
    const hit = rules.play(miss.position, 'e5:hit', '', ['j10:miss'])!;
    expect([hit.turn, hit.label]).toEqual(['white', 'E5 hit']);
    const sinks = rules.play(
      at(['j1:hit', 'a1:hit']),
      'j2:sunk:destroyer',
      '',
      []
    )!;
    expect([sinks.turn, sinks.label]).toEqual([
      'black',
      'J2 sinks the destroyer',
    ]);
  });
  test('the 17th hit sinks the fifth ship and wins at once', () => {
    VICTORY.forEach((action, ply) =>
      expect(resolve(VICTORY.slice(0, ply), action.split(':')[0]!)).toBe(action)
    );
    let position = rules.initial();
    for (const [ply, action] of VICTORY.entries()) {
      const played = rules.play(position, action, '', VICTORY.slice(0, ply))!;
      const last = ply === VICTORY.length - 1;
      expect(played.winner).toBe(last ? 'white' : null);
      expect(played.reason).toBe(last ? 'fleet sunk' : null);
      position = played.position;
    }
    expect(position).toBe(`bs:1:${VICTORY.join(',')}`);
    expect(decodeBattleshipPosition(position).winner).toBe('white');
    expect(rules.canWin(position, 'white')).toBe(true);
    expect(rules.canWin(position, 'black')).toBe(false);
  });
  test('nothing is accepted after the victory', () => {
    const won = at(VICTORY);
    expect(rules.legal(won)).toEqual([]);
    for (const action of ['j10:miss', 'h1:hit', 'a1:miss', 'e5'])
      expect(rules.play(won, action, '', VICTORY)).toBeNull();
    expect(setupRules.resolve(won, 'h1', FLEETS)).toBeNull();
    expect(setupRules.resolve(won, 'j10', FLEETS)).toBeNull();
  });
  test('a refused action leaves the position as it was', () => {
    const before = at(['a1:hit', 'j1:miss']);
    const legal = rules.legal(before);
    for (const action of [
      'e5',
      'E5:miss',
      'e5:Miss',
      'e5:hit ',
      'e5:sunk',
      'e5:sunk:patrol',
      'a1:miss',
      'a1:hit',
      'k5:miss',
      'e5:sunk:carrier',
    ])
      expect(rules.play(before, action, '', [])).toBeNull();
    expect(rules.legal(before)).toEqual(legal);
    expect(rules.replay(['a1:hit', 'j1:miss'], 2)).toBe(before);
  });
  test('shots no fleet could explain are refused', () => {
    const sunkTwice = ['a1:hit', 'j1:miss', 'b1:sunk:destroyer', 'j2:miss'];
    expect(rules.play(at(sunkTwice), 'c1:sunk:destroyer', '', [])).toBeNull();
    expect(rules.play(at(sunkTwice), 'c1:hit', '', [])).not.toBeNull();
    const fourHits = ['a1:hit', 'j1:miss', 'b1:hit', 'j2:miss', 'c1:hit'];
    fourHits.push('j3:miss', 'd1:hit', 'j4:miss');
    expect(rules.play(at(fourHits), 'e1:sunk:carrier', '', [])).not.toBeNull();
    expect(
      rules.play(at(fourHits.slice(0, 6)), 'd1:sunk:carrier', '', [])
    ).toBeNull();
    const sixteen = VICTORY.slice(0, -1);
    expect(rules.play(at(sixteen), 'c9:hit', '', [])).toBeNull();
    expect(rules.play(at(sixteen), 'c9:miss', '', [])).not.toBeNull();
  });
  test('the move list labels every shot with its positions', () => {
    const actions = ['e5:miss', 'a1:hit', 'c3:hit'];
    expect(rules.moves(at(actions), '', actions)).toEqual([
      { label: 'E5 miss', before: 'bs:1:', after: 'bs:1:e5:miss' },
      {
        label: 'A1 hit',
        before: 'bs:1:e5:miss',
        after: 'bs:1:e5:miss,a1:hit',
      },
      {
        label: 'C3 hit',
        before: 'bs:1:e5:miss,a1:hit',
        after: 'bs:1:e5:miss,a1:hit,c3:hit',
      },
    ]);
    expect(() => rules.replay(['e5'], 1)).toThrow();
    expect(rules.replay(['e5'], 0)).toBe('bs:1:');
  });
});
