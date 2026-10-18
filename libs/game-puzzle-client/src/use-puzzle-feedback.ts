import type { PuzzleFeedback } from './puzzle-client';
import { usePuzzleGame } from './puzzle-game-context';

const SILENT: PuzzleFeedback = {
  onCorrectMove: () => {},
  onWrongMove: () => {},
  onSolved: () => {},
  onRatingComplete: () => {},
};

/** The game's sounds and haptics for an attempt's moments; silent without. */
export function usePuzzleFeedback(): PuzzleFeedback {
  const { client } = usePuzzleGame();
  return client.useFeedback?.() ?? SILENT;
}
