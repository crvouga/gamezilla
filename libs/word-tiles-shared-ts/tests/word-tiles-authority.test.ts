import { describe, expect, test } from 'bun:test';
import { resolveProposal } from '../src/word-tiles-authority';
import {
  decodeHidden,
  encodeHidden,
  type HiddenState,
} from '../src/word-tiles-hidden';
import type { Lexicon } from '../src/word-tiles-lexicon';
import { playEncoded } from '../src/word-tiles-play';
import {
  decodePosition,
  encodePosition,
  type WordTilesPosition,
} from '../src/word-tiles-position';
import {
  at,
  boardWith,
  hiddenWith,
  lexicon,
  positionFor,
} from './word-tiles-fixtures';

let words: Lexicon;

async function decide(
  position: WordTilesPosition,
  hidden: HiddenState,
  proposal: string
) {
  words ??= await lexicon();
  const encoded = encodePosition(position);
  const resolution = resolveProposal(
    encoded,
    proposal,
    encodeHidden(hidden),
    words
  );
  if (!resolution.ok) return { refusal: resolution.refusal } as const;
  const played = playEncoded(encoded, resolution.action);
  if (played === null) throw new Error('the rules refused the recorded action');
  return {
    action: resolution.action,
    position: decodePosition(played.position)!,
    hidden: decodeHidden(resolution.hidden, position.seats)!,
  } as const;
}

async function accepted(
  position: WordTilesPosition,
  hidden: HiddenState,
  proposal: string
) {
  const result = await decide(position, hidden, proposal);
  if ('refusal' in result) throw new Error(result.refusal);
  return result;
}

describe('placements', () => {
  test('an opening word scores, refills and passes the turn', async () => {
    const hidden = hiddenWith({ racks: ['CATXQZJ', 'EEEEEEE'] });
    const [c, a, t] = hidden.racks[0]!;
    const result = await accepted(
      positionFor(hidden),
      hidden,
      `play:${at('g8', c!)}.${at('h8', a!)}.${at('i8', t!)}`
    );
    expect(result.action).toBe('play:g8C.h8A.i8T');
    expect(result.position.scores).toEqual([10, 0]);
    expect(result.position.racks).toEqual([7, 7]);
    expect(result.position.bag).toBe(100 - 14 - 3);
    expect(result.position.turn).toBe(1);
  });
  test('a word missing from the word list is refused and nothing changes', async () => {
    const hidden = hiddenWith({ racks: ['ZQXJKVW', 'EEEEEEE'] });
    const [z, q] = hidden.racks[0]!;
    const result = await decide(
      positionFor(hidden),
      hidden,
      `play:${at('h8', z!)}.${at('i8', q!)}`
    );
    expect(result).toEqual({ refusal: 'not in the word list: ZQ' });
  });
  test('an invalid cross-word refuses the whole placement', async () => {
    const hidden = hiddenWith({ racks: ['SQAAAAA', 'EEEEEEE'], board: 'CAT' });
    const [s, q] = hidden.racks[0]!;
    const position = positionFor(hidden, {
      board: boardWith([['g8', 'across', 'CAT']]),
    });
    const result = await decide(
      position,
      hidden,
      `play:${at('j8', s!)}.${at('j9', q!)}`
    );
    expect(result).toEqual({ refusal: 'not in the word list: SQ' });
  });
  test('tiles must be the mover’s own', async () => {
    const hidden = hiddenWith({ racks: ['CATAAAA', 'DOGEEEE'] });
    const [d, o, g] = hidden.racks[1]!;
    const result = await decide(
      positionFor(hidden),
      hidden,
      `play:${at('g8', d!)}.${at('h8', o!)}.${at('i8', g!)}`
    );
    expect(result).toEqual({ refusal: 'not your tiles' });
  });
  test('one tile cannot be spent twice', async () => {
    const hidden = hiddenWith({ racks: ['AAAAAAA', 'EEEEEEE'] });
    const [a] = hidden.racks[0]!;
    const result = await decide(
      positionFor(hidden),
      hidden,
      `play:${at('h8', a!)}.${at('i8', a!)}`
    );
    expect(result).toEqual({ refusal: 'not a move' });
  });
  test('a blank keeps the letter it is played as and scores nothing', async () => {
    const hidden = hiddenWith({ racks: ['C?TAAAA', 'EEEEEEE'] });
    const [c, blank, t] = hidden.racks[0]!;
    const result = await accepted(
      positionFor(hidden),
      hidden,
      `play:${at('g8', c!)}.${at('h8', blank!, 'A')}.${at('i8', t!)}`
    );
    expect(result.action).toBe('play:g8C.h8a.i8T');
    expect(result.position.scores[0]).toBe(8);
    expect(result.position.board[7 * 15 + 7]).toBe('a');
  });
  test('a short bag refills only what it holds', async () => {
    const hidden = hiddenWith({ racks: ['CATAAAA', 'EEEEEEE'], bagSize: 2 });
    const [c, a, t] = hidden.racks[0]!;
    const result = await accepted(
      positionFor(hidden),
      hidden,
      `play:${at('g8', c!)}.${at('h8', a!)}.${at('i8', t!)}`
    );
    expect(result.position.racks).toEqual([6, 7]);
    expect(result.position.bag).toBe(0);
  });
});

describe('exchanges and passes', () => {
  test('an exchange needs seven tiles in the bag', async () => {
    const seven = hiddenWith({ racks: ['QWZXJKV', 'EEEEEEE'], bagSize: 7 });
    const q = seven.racks[0]![0]!;
    const result = await accepted(positionFor(seven), seven, `swap:${q}`);
    expect(result.action).toBe('swap:1');
    expect(result.position.bag).toBe(7);
    expect(result.hidden.racks[0]).not.toContain(q);
    expect(result.hidden.bag).toContain(q);
    const six = hiddenWith({ racks: ['QWZXJKV', 'EEEEEEE'], bagSize: 6 });
    expect(
      await decide(positionFor(six), six, `swap:${six.racks[0]![0]}`)
    ).toEqual({
      refusal: 'too few tiles in the bag to exchange',
    });
  });
  test('the replacements come from the bag as it was', async () => {
    const hidden = hiddenWith({
      racks: ['QWZXJKV', 'EEEEEEE'],
      bagFront: 'AE',
    });
    const [q, w] = hidden.racks[0]!;
    const result = await accepted(
      positionFor(hidden),
      hidden,
      `swap:${q}.${w}`
    );
    const front = hidden.bag.slice(0, 2);
    expect(result.hidden.racks[0]).toEqual([
      ...hidden.racks[0]!.slice(2),
      ...front,
    ]);
  });
  test('six scoreless turns end the game and racks count against their holders', async () => {
    let hidden = hiddenWith({ racks: ['QZAAAAA', 'EEEEEEE'] });
    let position = positionFor(hidden);
    const actions: string[] = [];
    for (let turn = 0; turn < 6; turn++) {
      const result = await accepted(position, hidden, 'pass');
      actions.push(result.action);
      ({ position, hidden } = result);
    }
    expect(actions.slice(0, 5)).toEqual([
      'pass',
      'pass',
      'pass',
      'pass',
      'pass',
    ]);
    // Q10 Z10 and five A = 25; seven E = 7.
    expect(actions[5]).toBe('pass;end:25,7');
    expect(position.ended).toBe('scoreless');
    expect(position.scores).toEqual([-25, -7]);
    expect(await decide(position, hidden, 'pass')).toEqual({
      refusal: 'the game is over',
    });
  });
  test('a positive placement resets the scoreless run', async () => {
    const hidden = hiddenWith({ racks: ['CATAAAA', 'EEEEEEE'] });
    const [c, a, t] = hidden.racks[0]!;
    const result = await accepted(
      positionFor(hidden, { scoreless: 5 }),
      hidden,
      `play:${at('g8', c!)}.${at('h8', a!)}.${at('i8', t!)}`
    );
    expect(result.position.scoreless).toBe(0);
    expect(result.position.ended).toBeNull();
  });
});

describe('going out', () => {
  test('emptying the rack with an empty bag ends the game and takes the others’ racks', async () => {
    const hidden = hiddenWith({ racks: ['AT', 'QZ', 'EE'], bagSize: 0 });
    const [a, t] = hidden.racks[0]!;
    const position = positionFor(hidden, {
      board: boardWith([['h7', 'down', 'C']]),
      scores: [10, 30, 5],
    });
    const result = await accepted(
      position,
      hidden,
      `play:${at('h8', a!)}.${at('h9', t!)}`
    );
    // CAT: C3 A1 (h8 double word) T1 = 10; the others hold Q+Z = 20 and E+E = 2.
    expect(result.action).toBe('play:h8A.h9T;end:0,20,2');
    expect(result.position.ended).toBe('out');
    expect(result.position.scores).toEqual([10 + 10 + 22, 10, 3]);
  });
  test('tied leaders share the win', async () => {
    let hidden = hiddenWith({ racks: ['EEEEEEE', 'AAAAAAA'] });
    let position = positionFor(hidden);
    for (let turn = 0; turn < 6; turn++)
      ({ position, hidden } = await accepted(position, hidden, 'pass'));
    expect(position.scores).toEqual([-7, -7]);
  });
});
