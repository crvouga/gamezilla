import type { BoardArrow, Move } from '@pkgs/chess-board-core/types';
import type { Clock } from '@pkgs/clock/types';
import type { RecordingAudio } from './recording-audio';

export function createExampleEvidence(clock: Clock, audio: RecordingAudio) {
  const moves: string[] = [];
  const moveRecords: Move[] = [];
  const userArrowChanges: (readonly BoardArrow[])[] = [];
  let userArrowSnapshot: readonly BoardArrow[] = [];
  let arrowObservationStart = 0;
  let keyboardInput: { key: string; before: string | null } | null = null;
  let feedbackReadyAt = clock.now();
  function clearMoves() {
    moves.length = 0;
    moveRecords.length = 0;
  }
  return {
    moves,
    moveRecords,
    clearMoves,
    userArrowChanges,
    userArrowSnapshot: () => userArrowSnapshot,
    keyboardInput: () => keyboardInput,
    recordKeyboardInput(key: string, before: string | null) {
      keyboardInput = { key, before };
    },
    beginArrowObservation() {
      arrowObservationStart = userArrowChanges.length;
    },
    arrowOffers: () => userArrowChanges.length - arrowObservationStart,
    onUserArrowsChange(arrows: readonly BoardArrow[]) {
      userArrowSnapshot = arrows.map((arrow) => ({ ...arrow }));
      userArrowChanges.push(userArrowSnapshot);
    },
    feedbackReadyAt: () => feedbackReadyAt,
    touched: () => {
      feedbackReadyAt = clock.now() + 1000;
    },
    onMove(move: Move) {
      moves.push(`${move.from}${move.to}`);
      moveRecords.push(move);
    },
    clearEvidence() {
      clearMoves();
      userArrowChanges.length = 0;
      arrowObservationStart = 0;
      keyboardInput = null;
      audio.clear();
      feedbackReadyAt = clock.now();
    },
  };
}
