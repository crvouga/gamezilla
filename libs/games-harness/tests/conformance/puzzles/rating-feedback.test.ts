import { expect, test } from 'bun:test';
import { usePuzzleRatingFeedback } from '@libs/game-puzzle-client/use-puzzle-rating-feedback';
import type { PuzzleCompletion } from '@libs/game-puzzle-shared/completion';
import { createRoot, createSignal } from 'solid-js';
import { forEveryGame } from '../game-suite';
import { puzzleCase } from './puzzle-room';

function feedback(initial: PuzzleCompletion) {
  const cues: number[] = [];
  const displayed: number[] = [];
  const root = createRoot((dispose) => {
    const [completion, setCompletion] = createSignal(initial);
    const [enabled, setEnabled] = createSignal(true);
    const rating = usePuzzleRatingFeedback({
      completion,
      feedbackEnabled: enabled,
      onDisplayRatingChange: (value) => displayed.push(value),
      onRatingComplete: (delta) => cues.push(delta),
    });
    return { dispose, completion, setCompletion, setEnabled, rating };
  });
  return { ...root, cues, displayed };
}

forEveryGame(import.meta.path, (game) => {
  const puzzleRating = puzzleCase(game).known[0].record.rating;
  const rated: PuzzleCompletion = {
    outcome: 'solved',
    ratingBefore: 1500,
    ratingAfter: 1516,
    delta: 16,
    streak: 1,
    puzzleRating,
    rated: true,
  };

  // regression: chess-puzzle-duplicate-rating-feedback
  test('equivalent completion updates never replay a rating cue', () => {
    const probe = feedback(rated);
    try {
      expect(probe.cues).toEqual([16]);
      for (let delivery = 0; delivery < 3; delivery++)
        probe.setCompletion({ ...rated });
      expect(probe.cues).toEqual([16]);
      expect(probe.displayed).toEqual([1516]);
      expect(probe.rating.displayRating()).toBe(1516);
    } finally {
      probe.dispose();
    }
  });

  // regression: chess-puzzle-rating-feedback-late
  test('a late rating replaces the preliminary completion and sounds once', () => {
    const probe = feedback({
      ...rated,
      ratingAfter: 1500,
      delta: 0,
      rated: false,
    });
    try {
      expect(probe.rating.displayRating()).toBe(1500);
      probe.setCompletion(rated);
      expect(probe.cues).toEqual([0, 16]);
      expect(probe.displayed).toEqual([1500, 1516]);
      expect(probe.rating.displayRating()).toBe(1516);
      probe.setCompletion({ ...rated });
      expect(probe.cues).toEqual([0, 16]);
    } finally {
      probe.dispose();
    }
  });

  test('silence changes never repeat a completed cue, and disposal stops feedback', () => {
    const probe = feedback(rated);
    probe.setEnabled(false);
    probe.setCompletion({ ...rated, ratingAfter: 1520, delta: 20 });
    expect(probe.cues).toEqual([16]);
    probe.setEnabled(true);
    expect(probe.cues).toEqual([16]);
    probe.dispose();
    probe.setCompletion({ ...rated, ratingAfter: 1530, delta: 30 });
    expect(probe.cues).toEqual([16]);
  });
});
