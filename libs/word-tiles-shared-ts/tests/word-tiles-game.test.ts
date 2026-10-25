import { beforeAll, describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import type {
  BotDifficulty,
  GameSide,
} from '@pkgs/turn-game-shared-ts/game-rules';
import fc from 'fast-check';
import {
  conserves,
  decodeHidden,
  encodeHidden,
  type HiddenState,
  nextRandom,
  type RandomState,
  shuffled,
} from '../src/word-tiles-hidden';
import { decodePosition } from '../src/word-tiles-position';
import {
  WORD_TILES_RULES,
  wordTilesBots,
  wordTilesHands,
} from '../src/word-tiles-rules';
import type { WordTilesSeatCount } from '../src/word-tiles-ruleset';
import { BLANK, TILES } from '../src/word-tiles-tiles';
import { lexicon } from './word-tiles-fixtures';

beforeAll(async () => {
  await lexicon();
});

function seeded(seed: number): () => number {
  let state: RandomState = [seed >>> 0, 1, 2, 3];
  return () => {
    const step = nextRandom(state);
    state = step.state;
    return step.value;
  };
}

/** The board's letters agree with the tile ids the authority put there. */
function boardAgrees(board: string, hidden: HiddenState): boolean {
  const onBoard = [...board].filter((c) => c !== '.');
  const letters = (s: string) =>
    [...s].map((c) => (c === c.toLowerCase() ? BLANK : c)).sort();
  const symbols = hidden.board.map((id) => TILES[id]!.symbol).sort();
  return JSON.stringify(letters(onBoard.join(''))) === JSON.stringify(symbols);
}

type Step = {
  readonly position: string;
  readonly hidden: string;
  readonly action: string;
};

/** A whole game of bots, as the authority plays it. */
function botGame(
  seats: WordTilesSeatCount,
  seed: number,
  difficulty: BotDifficulty
): readonly Step[] {
  const rules = WORD_TILES_RULES[seats];
  const random = seeded(seed);
  let position = rules.initial();
  let hidden = wordTilesHands.deal(position, random);
  let history = '';
  const steps: Step[] = [];
  for (let ply = 0; ply < 400; ply++) {
    const decoded = decodePosition(position)!;
    if (decoded.ended !== null) return steps;
    const side = rules.sides![decoded.turn] as GameSide;
    const hand = wordTilesHands.hand(hidden, side);
    const proposal = wordTilesBots.choose(position, difficulty, random, hand)!;
    const resolution = wordTilesHands.resolve(position, proposal, hidden);
    if ('refusal' in resolution)
      throw new Error(`${proposal}: ${resolution.refusal}`);
    const next = rules.play(position, resolution.action, history, []);
    if (next === null) throw new Error(`rules refused ${resolution.action}`);
    position = next.position;
    hidden = resolution.hidden;
    history = next.history;
    steps.push({ position, hidden, action: resolution.action });
  }
  throw new Error('the game did not finish in 400 turns');
}

describe('whole games', () => {
  for (const seats of [2, 3, 4] as const)
    test(`bots finish a ${seats}-seat game, every tile always in exactly one place`, () => {
      const steps = botGame(seats, 1234 + seats, 'easy');
      for (const step of steps) {
        const hidden = decodeHidden(step.hidden, seats)!;
        expect(conserves(hidden)).toBe(true);
        const position = decodePosition(step.position)!;
        expect(boardAgrees(position.board, hidden)).toBe(true);
        expect(hidden.bag.length).toBe(position.bag);
        expect(hidden.racks.map((r) => r.length)).toEqual([...position.racks]);
      }
      expect(decodePosition(steps.at(-1)!.position)!.ended).not.toBeNull();
      const rules = WORD_TILES_RULES[seats];
      const actions = steps.map((s) => s.action);
      expect(rules.replay(actions, actions.length)).toBe(
        steps.at(-1)!.position
      );
    }, 60_000);

  test('the same deal and the same proposals decide alike', () => {
    expect(botGame(2, 99, 'medium')).toEqual(botGame(2, 99, 'medium'));
  }, 60_000);
});

describe('the authority', () => {
  test('a refused proposal leaves nothing changed and draws nothing', () => {
    const rules = WORD_TILES_RULES[2];
    const position = rules.initial();
    const hidden = wordTilesHands.deal(position, seeded(5));
    const rack = decodeHidden(hidden, 2)!.racks[0]!;
    const foreign = decodeHidden(hidden, 2)!.racks[1]![0]!;
    assertProperty(
      'refusals are atomic',
      fc.property(
        fc.oneof(
          fc.string(),
          fc.constant(`swap:${foreign}`),
          fc.constant(`play:a1=${rack[0]}.b1=${rack[1]}`),
          fc.constant(`play:h8=${foreign}.i8=${rack[0]}`),
          fc.constant(`play:h8=${rack[0]}.h8=${rack[1]}`)
        ),
        (proposal) => {
          const before = hidden;
          const resolution = wordTilesHands.resolve(position, proposal, hidden);
          if ('refusal' in resolution) expect(hidden).toBe(before);
          else expect(proposal).toMatch(/^(pass|swap:|play:)/);
        }
      )
    );
  });

  test('what others see does not depend on tiles they cannot see', () => {
    const rules = WORD_TILES_RULES[3];
    const steps = botGame(3, 77, 'easy');
    assertProperty(
      'noninterference',
      fc.property(
        fc.integer({ min: 0, max: steps.length - 2 }),
        fc.integer({ min: 0, max: 0xffffffff }),
        (at, seed) => {
          const { position, hidden } = steps[at]!;
          const decoded = decodePosition(position)!;
          const state = decodeHidden(hidden, 3)!;
          const mover = decoded.turn;
          // Swap the tiles the mover cannot see among the bag and other racks.
          const unseen = [
            ...state.bag,
            ...state.racks.filter((_, s) => s !== mover).flat(),
          ];
          const mixed = shuffled(unseen, [seed >>> 0, 5, 6, 7]).ids;
          let cursor = 0;
          const take = (n: number) => mixed.slice(cursor, (cursor += n));
          const other: HiddenState = {
            ...state,
            racks: state.racks.map((r, s) =>
              s === mover ? r : take(r.length)
            ),
            bag: take(state.bag.length),
          };
          const proposal = steps[at + 1]!.action.startsWith('play:')
            ? wordTilesBots.choose(
                position,
                'easy',
                seeded(seed),
                wordTilesHands.hand(hidden, rules.sides![mover]!)
              )!
            : 'pass';
          const a = wordTilesHands.resolve(position, proposal, hidden);
          const b = wordTilesHands.resolve(
            position,
            proposal,
            encodeHidden(other)
          );
          if ('refusal' in a || 'refusal' in b)
            return expect('refusal' in a).toBe('refusal' in b);
          // Only an ending reveals rack values; anything else is identical.
          if (!a.action.includes(';end:')) expect(b.action).toBe(a.action);
        }
      ),
      { numRuns: 30 }
    );
  }, 60_000);
});
