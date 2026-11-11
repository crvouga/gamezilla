/** The puzzle stats' place machine, walked as a device walks it. */

import { describe, expect, test } from 'bun:test';
import {
  PUZZLE_STATS_PLACES,
  type PuzzleStatsPlace,
  type PuzzleStatsStage,
  puzzleStatsStageOf,
} from '@libs/game-puzzle-client-ts/puzzle-stats-places';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import {
  type OpenedPlace,
  placeBehind,
  placeIn,
  stageShows,
} from '@pkgs/turn-game-client-ts/screen-places';
import fc from 'fast-check';

const stage = fc.constantFrom<PuzzleStatsStage>('loading', 'ready');
const place = fc.oneof(
  fc.constantFrom<PuzzleStatsPlace>(
    { screen: 'summary' },
    { screen: 'trend' },
    { screen: 'log' }
  ),
  fc
    .constantFrom('chess:a', 'chess:b')
    .map((puzzleId): PuzzleStatsPlace => ({ screen: 'review', puzzleId }))
);

type Step =
  | { readonly kind: 'open'; readonly place: PuzzleStatsPlace }
  | { readonly kind: 'back' }
  | { readonly kind: 'stage'; readonly stage: PuzzleStatsStage };

const step = fc.oneof(
  place.map((opened): Step => ({ kind: 'open', place: opened })),
  fc.constant<Step>({ kind: 'back' }),
  stage.map((next): Step => ({ kind: 'stage', stage: next }))
);

type Seen = {
  readonly stage: PuzzleStatsStage;
  readonly place: PuzzleStatsPlace;
};

/** A device walking the machine as `useEnteredPlace` does. */
function walk(steps: readonly Step[]): Seen[] {
  let at: PuzzleStatsStage = 'loading';
  let opened: OpenedPlace<PuzzleStatsStage, PuzzleStatsPlace> | null = null;
  const seen: Seen[] = [];
  for (const next of steps) {
    if (next.kind === 'stage' && next.stage !== at) {
      at = next.stage;
      opened = null;
    }
    if (next.kind === 'open') opened = { stage: at, place: next.place };
    if (next.kind === 'back') {
      const behind: PuzzleStatsPlace | null = placeBehind(
        PUZZLE_STATS_PLACES,
        at,
        placeIn(PUZZLE_STATS_PLACES, at, opened)
      );
      opened = behind === null ? null : { stage: at, place: behind };
    }
    seen.push({ stage: at, place: placeIn(PUZZLE_STATS_PLACES, at, opened) });
  }
  return seen;
}

describe('the puzzle stats places', () => {
  test('whatever is opened, backed out of or changed, the place shown is one its stage shows', () => {
    assertProperty(
      'whatever is opened, backed out of or changed, the place show',
      fc.property(fc.array(step, { maxLength: 40 }), (steps) => {
        for (const seen of walk(steps))
          expect(stageShows(PUZZLE_STATS_PLACES, seen.stage, seen.place)).toBe(
            true
          );
      })
    );
  });

  test('while the history is unknown only the summary shows', () => {
    assertProperty(
      'while the history is unknown only the summary shows',
      fc.property(fc.array(step, { maxLength: 40 }), (steps) => {
        for (const seen of walk(steps))
          if (seen.stage === 'loading')
            expect(seen.place.screen).toBe('summary');
      })
    );
  });

  test('Back reaches the summary in at most two steps: a review through the log', () => {
    assertProperty(
      'Back reaches the summary in at most two steps: a review thro',
      fc.property(place, (opened) => {
        const path: string[] = [];
        let current: PuzzleStatsPlace | null = opened;
        while (current !== null && path.length < 5) {
          path.push(current.screen);
          current = placeBehind(PUZZLE_STATS_PLACES, 'ready', current);
        }
        expect(path.at(-1)).toBe('summary');
        expect(path.length).toBeLessThanOrEqual(3);
        if (opened.screen === 'review')
          expect(path).toEqual(['review', 'log', 'summary']);
      })
    );
  });

  test('the stage is whether the history has been read', () => {
    expect(puzzleStatsStageOf({ loading: true })).toBe('loading');
    expect(puzzleStatsStageOf({ loading: false })).toBe('ready');
  });
});
