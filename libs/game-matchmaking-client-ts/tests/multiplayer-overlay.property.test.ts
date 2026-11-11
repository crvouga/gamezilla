/**
 * What the matched game's board is covered by follows its stage and its
 * outcome alone: the phase the overlay machine is fed, the tone of the
 * result card, and the clock said in plain words.
 */

import { describe, expect, test } from 'bun:test';
import { multiplayerResultTone } from '@libs/game-matchmaking-client-ts/multiplayer-outcome';
import { multiplayerOverlayPhase } from '@libs/game-matchmaking-client-ts/multiplayer-overlay-view';
import {
  MULTIPLAYER_PLACES,
  type MultiplayerStage,
} from '@libs/game-matchmaking-client-ts/multiplayer-places';
import { timeControlWords } from '@libs/game-matchmaking-client-ts/time-control-name';
import type { MultiplayerOutcome } from '@libs/game-matchmaking-shared-ts/game-state';
import { TIME_CONTROLS } from '@libs/game-matchmaking-shared-ts/time-control';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import {
  NO_STAGE_OVERLAY,
  type StageOverlay,
  stageOverlayAfter,
  stageOverlayOpening,
  stageOverlayPhaseEvent,
} from '@pkgs/turn-game-client-ts/stage-overlay';
import fc from 'fast-check';

const STAGES = Object.keys(MULTIPLAYER_PLACES.home) as MultiplayerStage[];
const stage = fc.constantFrom<MultiplayerStage>(...STAGES);
const SIDES = ['white', 'black', 'red', 'blue'] as const;
const outcome = fc.constantFrom<MultiplayerOutcome>(
  'ongoing',
  'draw',
  'aborted',
  ...SIDES
);

/** The overlay after a device opened on `first` and watched `rest` follow. */
function overlayThrough(
  first: MultiplayerStage,
  rest: readonly MultiplayerStage[]
): StageOverlay {
  let seen = multiplayerOverlayPhase(first);
  let overlay = stageOverlayOpening(seen);
  for (const next of rest) {
    const to = multiplayerOverlayPhase(next);
    const event = stageOverlayPhaseEvent(seen, to);
    seen = to;
    if (event !== null) overlay = stageOverlayAfter(overlay, event);
  }
  return overlay;
}

describe("the matched game's overlay follows its stage", () => {
  test('whatever stages were watched, a finished game is under its result and a search under nothing', () => {
    assertProperty(
      'overlay follows stage',
      fc.property(stage, fc.array(stage, { maxLength: 12 }), (first, rest) => {
        const last = rest.at(-1) ?? first;
        const overlay = overlayThrough(first, rest);
        if (last === 'finished') expect(overlay.kind).toBe('outcome');
        else expect(['none', 'versus']).toContain(overlay.kind);
        if (last !== 'playing') expect(overlay.kind).not.toBe('versus');
      })
    );
  });

  test('the versus card plays only for a game watched begin from a search, a setup or a result', () => {
    assertProperty(
      'versus only when watched begin',
      fc.property(stage, (before) => {
        const overlay = overlayThrough(before, ['playing']);
        const watched =
          before !== 'playing' && before !== 'loading' && before !== 'denied';
        expect(overlay.kind).toBe(watched ? 'versus' : 'none');
      })
    );
  });

  test('a game opened already in play shows its board at once', () => {
    expect(overlayThrough('loading', ['playing'])).toEqual(NO_STAGE_OVERLAY);
    expect(overlayThrough('playing', [])).toEqual(NO_STAGE_OVERLAY);
  });
});

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
