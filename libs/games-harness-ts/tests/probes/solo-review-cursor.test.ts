import { expect, test } from 'bun:test';
import { PuzzleGameProvider } from '@libs/game-puzzle-client-ts/puzzle-game-context';
import {
  type PuzzleReviewBoardModel,
  usePuzzleReviewBoard,
} from '@libs/game-puzzle-client-ts/use-puzzle-review-board';
import type { TurnHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { TurnGamesProvider } from '@pkgs/turn-game-client-ts/turn-games-context';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { createComponent, createRoot, createSignal } from 'solid-js';
import { COUNTING_RACE_GAME } from '../reference-game/counting-race-game';
import { SOLO_COUNT_GAME } from './solo-count-game';

type ReviewCase = {
  readonly game: TurnHarnessGame;
  readonly position: string;
  readonly moves: string;
  readonly lineMode: 'solver-only' | 'opponent-replies';
};
const SOLO_CASE: ReviewCase = {
  game: SOLO_COUNT_GAME,
  position: 'solo-count:3w',
  moves: 'two two',
  lineMode: 'solver-only',
};

/** A controller probe, independent of the consumer's fixture catalogue. */
function openReview(initial: number | null = 2, probe: ReviewCase = SOLO_CASE) {
  const registered = probe.game.shared.turnGame;
  const puzzles = registered.capabilities.puzzles;
  const client = probe.game.client.puzzles;
  if (puzzles === undefined || client === undefined)
    throw new Error('Missing puzzle probe');
  const rules = createTurnGames([
    {
      ...registered,
      capabilities: {
        puzzles: { ...puzzles, lineMode: probe.lineMode },
      },
    },
  ]);
  return createRoot((dispose) => {
    const [solveIdx, seek] = createSignal<number | null>(initial);
    let model: PuzzleReviewBoardModel | undefined;
    createComponent(TurnGamesProvider, {
      rules,
      presentations: [],
      get children() {
        return createComponent(PuzzleGameProvider, {
          gameId: registered.rules.id,
          client,
          get children() {
            model = usePuzzleReviewBoard(probe.position, probe.moves, {
              solveIdx,
              seek,
            });
            return null;
          },
        });
      },
    });
    if (model === undefined) throw new Error('Review controller did not mount');
    return { model, seek, solveIdx, dispose };
  });
}

// regression: solo-puzzle-review-cursor-zero-unset
test('a shared cursor at zero keeps the supplied solo position visible', () => {
  const review = openReview();
  try {
    expect(review.model.displayPosition()).toBe('solo-count:7w');
    review.seek(0);
    expect(review.solveIdx()).toBe(0);
    expect(review.model.solveIdx()).toBe(0);
    expect(review.model.displayPosition()).toBe('solo-count:3w');
    expect(review.model.canGoBack()).toBe(false);
    expect(review.model.canGoForward()).toBe(true);
  } finally {
    review.dispose();
  }
});

test('Home and forward review the supplied position and the next solo action', () => {
  const review = openReview();
  try {
    review.model.onNavigate('start');
    expect(review.solveIdx()).toBe(0);
    expect(review.model.displayPosition()).toBe('solo-count:3w');
    review.model.onNavigate('forward');
    expect(review.solveIdx()).toBe(1);
    expect(review.model.displayPosition()).toBe('solo-count:5w');
  } finally {
    review.dispose();
  }
});

// regression: puzzle-review-adjacent-list-jump-animates
test('selecting move one on the two-move solo line snaps, while stepping animates', () => {
  const review = openReview();
  try {
    review.model.onSeek(1);
    expect(review.model.solveIdx()).toBe(1);
    expect(review.model.displayPosition()).toBe('solo-count:5w');
    expect(review.model.animated()).toBe(false);
    review.model.onNavigate('forward');
    expect(review.model.solveIdx()).toBe(2);
    expect(review.model.animated()).toBe(true);
    review.model.onSeek(1);
    expect(review.model.animated()).toBe(false);
    review.model.onNavigate('start');
    expect(review.model.solveIdx()).toBe(0);
    expect(review.model.animated()).toBe(false);
  } finally {
    review.dispose();
  }
});

test('a newly mounted review preserves a selected zero without publishing another cursor', () => {
  const review = openReview(0);
  try {
    expect(review.solveIdx()).toBe(0);
    expect(review.model.solveIdx()).toBe(0);
    expect(review.model.displayPosition()).toBe('solo-count:3w');
  } finally {
    review.dispose();
  }
});

test('an unset review displays the end without changing shared state', () => {
  const review = openReview(null);
  try {
    expect(review.solveIdx()).toBeNull();
    expect(review.model.solveIdx()).toBe(2);
    expect(review.model.displayPosition()).toBe('solo-count:7w');
  } finally {
    review.dispose();
  }
});

test('an older opponent review cursor at zero still displays the line end', () => {
  const fixture = COUNTING_RACE_GAME.fixtures.puzzles?.[0];
  if (fixture === undefined) throw new Error('Missing known opponent puzzle');
  const review = openReview(0, {
    game: COUNTING_RACE_GAME,
    position: fixture.record.position,
    moves: fixture.record.line.join(' '),
    lineMode: 'opponent-replies',
  });
  try {
    expect(review.model.solveIdx()).toBe(fixture.record.line.length);
    expect(review.model.canGoBack()).toBe(true);
    expect(review.solveIdx()).toBe(0);
  } finally {
    review.dispose();
  }
});
