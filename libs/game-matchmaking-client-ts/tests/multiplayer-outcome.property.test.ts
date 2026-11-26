import { describe, expect, test } from 'bun:test';
import { multiplayerResultTone } from '@libs/game-matchmaking-client-ts/multiplayer-outcome';
import { timeControlWords } from '@libs/game-matchmaking-client-ts/time-control-name';
import type { MultiplayerOutcome } from '@libs/game-matchmaking-shared-ts/game-state';
import { TIME_CONTROLS } from '@libs/game-matchmaking-shared-ts/time-control';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

const SIDES = ['white', 'black', 'red', 'blue'] as const;
const outcome = fc.constantFrom<MultiplayerOutcome>(
  'ongoing',
  'draw',
  'aborted',
  ...SIDES
);

describe('the tone of the result card', () => {
  test('a watcher and a game without a result are never told they won or lost', () => {
    assertProperty(
      'neutral tone',
      fc.property(outcome, fc.constantFrom(...SIDES), (ended, side) => {
        expect(multiplayerResultTone({ outcome: ended }, null)).toBe('neutral');
        if (ended === 'ongoing' || ended === 'aborted')
          expect(multiplayerResultTone({ outcome: ended }, side)).toBe(
            'neutral'
          );
      })
    );
  });

  test('a side won exactly when the game names it, lost when it names another, and drew a draw', () => {
    assertProperty(
      'tone by outcome',
      fc.property(
        fc.constantFrom(...SIDES),
        fc.constantFrom(...SIDES),
        (winner, side) => {
          expect(multiplayerResultTone({ outcome: winner }, side)).toBe(
            winner === side ? 'won' : 'lost'
          );
          expect(multiplayerResultTone({ outcome: 'draw' }, side)).toBe(
            'drawn'
          );
        }
      )
    );
  });
});

describe('a time control in plain words', () => {
  test('every clock the platform offers is said without its shorthand', () => {
    for (const control of TIME_CONTROLS) {
      const words = timeControlWords(control.id);
      expect(words).not.toBe('');
      expect(words).not.toContain('+0');
      expect(words).not.toMatch(/^\d+\+\d+$/);
    }
  });

  test('minutes alone, minutes and the seconds a move adds, and nothing for none', () => {
    expect(timeControlWords('5+0')).toBe('5 min');
    expect(timeControlWords('5+3')).toBe('5 min + 3 sec');
    expect(timeControlWords('15+10')).toBe('15 min + 10 sec');
    expect(timeControlWords(null)).toBe('');
    expect(timeControlWords(undefined)).toBe('');
  });
});
