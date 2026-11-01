import { describe, expect, test } from 'bun:test';
import {
  battleshipBots,
  chooseBattleshipShot,
} from '@libs/battleship-shared-ts/battleship-bot';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import type { BotDifficulty } from '@pkgs/turn-game-shared-ts/game-rules';
import { createSeededRng } from '@pkgs/uuid-shared-ts/seeded-rng';
import fc from 'fast-check';
import {
  type Chooser,
  playOut,
  rules,
  seededFleets,
} from './battleship-oracle';

const DIFFICULTIES: readonly BotDifficulty[] = ['easy', 'medium', 'hard'];
const at = (actions: readonly string[]) =>
  rules.replay(actions, actions.length);
function botChooser(
  seed: string,
  white: BotDifficulty,
  black: BotDifficulty
): Chooser {
  const random = createSeededRng(`battleship-bot-${seed}`).random;
  return (position, mover) =>
    battleshipBots.choose(
      position,
      mover === 'white' ? white : black,
      random,
      null
    );
}
const ADJACENT_TO_E5 = ['d5', 'f5', 'e4', 'e6'];
const DRAWS = [0, 0.25, 0.5, 0.75, 0.999_999];

describe('battleship bots', () => {
  test('offers three strengths', () => {
    expect(battleshipBots.difficulties).toEqual(['easy', 'medium', 'hard']);
  });
  // regression: battleship-nightly-repeated-parsing
  test('two bots play only legal, fresh cells and finish within 199 shots', () =>
    assertProperty(
      'bots finish',
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.constantFrom(...DIFFICULTIES),
        fc.constantFrom(...DIFFICULTIES),
        (seed, white, black) => {
          const fleets = seededFleets(`bots-${seed}`);
          const game = playOut(fleets, botChooser(String(seed), white, black));
          const illegal = game.steps.filter(
            (step) => !rules.legal(step.before).includes(step.proposal)
          );
          expect(illegal).toEqual([]);
          expect(game.steps.length).toBeLessThanOrEqual(199);
          expect(game.steps.at(-1)?.played.winner).not.toBeNull();
          for (const difficulty of DIFFICULTIES)
            expect(
              battleshipBots.choose(game.position, difficulty, () => 0, null)
            ).toBe(null);
        }
      )
    ));
  test('easy draws uniformly among the legal cells by its random value', () => {
    const start = rules.initial();
    expect(chooseBattleshipShot(start, 'easy', () => 0)).toBe('a1');
    expect(chooseBattleshipShot(start, 'easy', () => 0.5)).toBe('a6');
    expect(chooseBattleshipShot(start, 'easy', () => 0.999_999)).toBe('j10');
  });
  test('medium hunts on one colour of the checkerboard', () => {
    for (const draw of DRAWS) {
      const cell = chooseBattleshipShot(rules.initial(), 'medium', () => draw)!;
      const column = 'abcdefghij'.indexOf(cell[0]!);
      expect((column + Number(cell.slice(1)) - 1) % 2).toBe(0);
    }
  });
  test('medium and hard follow up an unresolved hit next to it', () => {
    const position = at(['e5:hit', 'a1:miss']);
    for (const difficulty of ['medium', 'hard'] as const)
      for (const draw of DRAWS)
        expect(ADJACENT_TO_E5).toContain(
          chooseBattleshipShot(position, difficulty, () => draw)!
        );
  });
  test('medium and hard extend a line of aligned hits', () => {
    const position = at(['e5:hit', 'a1:miss', 'f5:hit', 'a2:miss']);
    for (const difficulty of ['medium', 'hard'] as const)
      for (const draw of DRAWS)
        expect(['d5', 'g5']).toContain(
          chooseBattleshipShot(position, difficulty, () => draw)!
        );
    const capped = at([
      ...['e5:hit', 'a1:miss', 'f5:hit', 'a2:miss', 'd5:miss', 'a3:miss'],
    ]);
    for (const draw of DRAWS)
      expect(chooseBattleshipShot(capped, 'medium', () => draw)).toBe('g5');
  });
  test('a sunk ship no longer draws fire to its neighbours', () => {
    const sunk = at(['e5:hit', 'a1:miss', 'f5:sunk:destroyer', 'a2:miss']);
    const missed = at(['e5:miss', 'a1:miss', 'f5:miss', 'a2:miss']);
    for (const difficulty of ['medium', 'hard'] as const)
      for (const draw of DRAWS)
        expect(chooseBattleshipShot(sunk, difficulty, () => draw)).toBe(
          chooseBattleshipShot(missed, difficulty, () => draw)
        );
  });
  test('the bot never sees a fleet: hidden fleets change its shots only through public outcomes', () => {
    expect(chooseBattleshipShot.length).toBe(3);
    expect(battleshipBots.choose.length).toBe(3);
    for (let seed = 0; seed < 12; seed++)
      for (const difficulty of DIFFICULTIES) {
        const [left, right] = ['left', 'right'].map((hidden) =>
          playOut(
            seededFleets(`${hidden}-${seed}`),
            botChooser(`noninterference-${seed}`, difficulty, difficulty)
          )
        ) as [ReturnType<typeof playOut>, ReturnType<typeof playOut>];
        const diverged = left.actions.findIndex(
          (action, ply) => right.actions[ply] !== action
        );
        const shared = diverged === -1 ? left.steps.length : diverged + 1;
        expect(
          right.steps.slice(0, shared).map((step) => step.proposal)
        ).toEqual(left.steps.slice(0, shared).map((step) => step.proposal));
      }
  });
  test('over the same 30 games, hard finishes sooner than medium, and medium than easy', () => {
    const average = (difficulty: BotDifficulty) => {
      let shots = 0;
      for (let seed = 0; seed < 30; seed++) {
        const fleets = seededFleets(`strength-${seed}`);
        const chooser = botChooser(`strength-${seed}`, difficulty, difficulty);
        shots += playOut(fleets, chooser).steps.length;
      }
      return shots / 30;
    };
    const easy = average('easy');
    const medium = average('medium');
    const hard = average('hard');
    expect(hard).toBeLessThan(medium);
    expect(medium).toBeLessThan(easy);
  });
});
