import { useMyId } from '@libs/auth-client-ts/use-current-user';
import { PuzzlePlayAttr } from '@libs/game-puzzle-shared-ts/play-attr';
import { PuzzleResultAttr } from '@libs/game-puzzle-shared-ts/play-result';
import { puzzleNamespaceOf } from '@libs/game-puzzle-shared-ts/puzzle-namespace';
import { useSpaceRoomSelector } from '@libs/spaces-client-ts/use-space-room-selector';
import { useLogger } from '@pkgs/logger-client-ts/solid';
import { usePuzzleGame } from './puzzle-game-context';
import { usePuzzleEntity, usePuzzleInteractions } from './puzzle-play-queries';
import { usePuzzleInteractionWrites } from './use-puzzle-interaction-writes';
import { usePuzzleResultRecorder } from './use-puzzle-result-recorder';

/**
 * A result belongs to the account, even when it is viewing stats or
 * settings. Each game offering puzzles records the results of its own
 * puzzles (those in its namespace).
 */
export function ReconcilePuzzleResult(): null {
  const myId = useMyId();
  const { namespace } = usePuzzleGame();
  const log = useLogger('chess-puzzle-result');
  const puzzleId = useSpaceRoomSelector(
    (state) => PuzzlePlayAttr.puzzleId.from(state) ?? ''
  );
  const result = useSpaceRoomSelector((state) => ({
    owner: PuzzleResultAttr.owner.from(state),
    attempt: PuzzleResultAttr.attempt.from(state),
    outcome: PuzzleResultAttr.outcome.from(state),
    score: PuzzleResultAttr.score.from(state),
  }));
  const solveIdx = useSpaceRoomSelector(PuzzlePlayAttr.solveIdx.from);
  const entity = usePuzzleEntity(puzzleId);
  const interactions = usePuzzleInteractions(puzzleId);
  const writes = usePuzzleInteractionWrites({
    puzzleId,
    puzzleRating: () => entity.rating,
    puzzleRatingDeviation: () => entity.ratingDeviation,
    solveIdx,
    attemptKey: () => result().attempt,
  });
  usePuzzleResultRecorder({
    myId,
    recorder: {
      puzzleId,
      interactionsReady: () => interactions.ready() && entity.fen.length > 0,
      canRecord: () =>
        result().owner === myId() &&
        puzzleNamespaceOf(puzzleId()) === namespace,
      result,
    },
    finalize: writes.finalizePlay,
    reportFailure: (error: unknown) =>
      log.error('puzzle result write failed', { puzzleId: puzzleId(), error }),
  });
  return null;
}
