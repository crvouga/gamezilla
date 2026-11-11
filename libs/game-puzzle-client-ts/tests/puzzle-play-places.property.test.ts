/** The puzzle feed's place machine, walked as a device walks it. */

import { describe, expect, test } from 'bun:test';
import {
  isPuzzleFeedPlace,
  isPuzzleOver,
  PUZZLE_FEED_SCREENS,
  PUZZLE_PLAY_PLACES,
  type PuzzlePlayPick,
  type PuzzlePlayPlace,
  type PuzzlePlayStage,
  puzzlePlayStageOf,
} from '@libs/game-puzzle-client-ts/puzzle-play-places';
import type { SolveStatus } from '@libs/game-puzzle-shared-ts/solve-status';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import {
  type OpenedPlace,
  placeBehind,
  placeIn,
  stageShows,
} from '@pkgs/turn-game-client-ts/screen-places';
import fc from 'fast-check';

const STAGES: readonly PuzzlePlayStage[] = [
  'loading',
  'offline',
  'limited',
  'empty',
  'waiting',
  'playing',
  'finished',
];
const SCREENS: readonly PuzzlePlayPlace['screen'][] = [
  'status',
  'play',
  'line',
  'result',
  ...PUZZLE_FEED_SCREENS,
];
const PICKS: readonly PuzzlePlayPick[] = [
  'loading',
  'offline',
  'limited',
  'empty',
  'waiting',
  'playing',
];
const STATUSES: readonly SolveStatus[] = [
  'loading',
  'idle',
  'solving',
  'wrong',
  'solved',
  'revealed',
  'skipped',
  'invalid',
];

const stage = fc.constantFrom(...STAGES);
const place = fc
  .constantFrom(...SCREENS)
  .map((screen): PuzzlePlayPlace => ({ screen }));

type Step =
  | { readonly kind: 'open'; readonly place: PuzzlePlayPlace }
  | { readonly kind: 'back' }
  | { readonly kind: 'stage'; readonly stage: PuzzlePlayStage };

const step = fc.oneof(
  place.map((opened): Step => ({ kind: 'open', place: opened })),
  fc.constant<Step>({ kind: 'back' }),
  stage.map((next): Step => ({ kind: 'stage', stage: next }))
);

type Seen = {
  readonly stage: PuzzlePlayStage;
  readonly place: PuzzlePlayPlace;
};

/**
 * A device walking the machine as `useScreenPlace` does: a stage is
 * entered on its home, whatever was opened in it before.
 */
function walk(steps: readonly Step[]): Seen[] {
  let at: PuzzlePlayStage = 'loading';
  let opened: OpenedPlace<PuzzlePlayStage, PuzzlePlayPlace> | null = null;
  const seen: Seen[] = [];
  for (const next of steps) {
    if (next.kind === 'stage' && next.stage !== at) {
      at = next.stage;
      opened = null;
    }
    if (next.kind === 'open') opened = { stage: at, place: next.place };
    if (next.kind === 'back') {
      const behind: PuzzlePlayPlace | null = placeBehind(
        PUZZLE_PLAY_PLACES,
        at,
        placeIn(PUZZLE_PLAY_PLACES, at, opened)
      );
      opened = behind === null ? null : { stage: at, place: behind };
    }
    seen.push({ stage: at, place: placeIn(PUZZLE_PLAY_PLACES, at, opened) });
  }
  return seen;
}

/** Backs from `from` until the stage's home; the places passed through. */
function backToHome(at: PuzzlePlayStage, from: PuzzlePlayPlace): string[] {
  const path: string[] = [];
  let current: PuzzlePlayPlace | null = from;
  while (current !== null && path.length < SCREENS.length) {
    path.push(current.screen);
    current = placeBehind(PUZZLE_PLAY_PLACES, at, current);
  }
  return path;
}

describe('the puzzle feed places', () => {
  test('whatever is opened, backed out of or changed, the place shown is one its stage shows', () => {
    assertProperty(
      'whatever is opened, backed out of or changed, the place show',
      fc.property(fc.array(step, { maxLength: 40 }), (steps) => {
        for (const seen of walk(steps))
          expect(stageShows(PUZZLE_PLAY_PLACES, seen.stage, seen.place)).toBe(
            true
          );
      })
    );
  });

  test('a stage is entered on its home, however it was left before', () => {
    assertProperty(
      'a stage is entered on its home, however it was left before',
      fc.property(
        fc.array(step, { maxLength: 40 }),
        stage,
        stage,
        (steps, from, to) => {
          fc.pre(from !== to);
          const seen = walk([
            ...steps,
            { kind: 'stage', stage: from },
            { kind: 'stage', stage: to },
          ]);
          expect(seen.at(-1)?.place.screen).toBe(
            PUZZLE_PLAY_PLACES.home[to].screen
          );
        }
      )
    );
  });

  test('Back reaches the home of the stage in at most two steps, from every place', () => {
    assertProperty(
      'Back reaches the home of the stage in at most two steps, fro',
      fc.property(stage, place, (at, opened) => {
        const from = placeIn(PUZZLE_PLAY_PLACES, at, {
          stage: at,
          place: opened,
        });
        const path = backToHome(at, from);
        expect(path.length).toBeLessThanOrEqual(3);
        expect(path.at(-1)).toBe(PUZZLE_PLAY_PLACES.home[at].screen);
      })
    );
  });

  test('one setting leads back to the settings, and the settings to the home', () => {
    for (const screen of PUZZLE_FEED_SCREENS) {
      const behind: PuzzlePlayPlace | null = placeBehind(
        PUZZLE_PLAY_PLACES,
        'playing',
        { screen }
      );
      expect(behind?.screen).toBe(screen === 'feed' ? 'play' : 'feed');
      expect(isPuzzleFeedPlace({ screen })).toBe(true);
    }
    expect(isPuzzleFeedPlace({ screen: 'play' })).toBe(false);
    const line: PuzzlePlayPlace = { screen: 'line' };
    expect(placeBehind(PUZZLE_PLAY_PLACES, 'finished', line)?.screen).toBe(
      'result'
    );
    expect(placeBehind(PUZZLE_PLAY_PLACES, 'playing', line)?.screen).toBe(
      'play'
    );
  });

  test('a watcher waiting for the host has only the status', () => {
    expect(PUZZLE_PLAY_PLACES.screens.waiting).toEqual(['status']);
  });
});

describe('the puzzle feed stage', () => {
  const inputs = fc.record({
    pick: fc.constantFrom(...PICKS),
    status: fc.constantFrom(...STATUSES),
    spectator: fc.boolean(),
  });

  test('without a placed puzzle the stage is the pick, whatever the room says', () => {
    assertProperty(
      'without a placed puzzle the stage is the pick, whatever the ',
      fc.property(inputs, (input) => {
        fc.pre(input.pick !== 'playing');
        expect(puzzlePlayStageOf(input)).toBe(input.pick);
      })
    );
  });

  test('a placed puzzle is finished exactly when it is over for its solver', () => {
    assertProperty(
      'a placed puzzle is finished exactly when it is over for its ',
      fc.property(inputs, (input) => {
        const over = !input.spectator && isPuzzleOver(input.status);
        expect(puzzlePlayStageOf({ ...input, pick: 'playing' })).toBe(
          over ? 'finished' : 'playing'
        );
      })
    );
  });

  test('solved, the solution shown and skipped are over; a wrong move is not', () => {
    expect(STATUSES.filter(isPuzzleOver)).toEqual([
      'solved',
      'revealed',
      'skipped',
    ]);
  });
});
