import { useMyId } from '@libs/auth/public/use-current-user';
import { useSpaceRoomSelector } from '@libs/spaces/public/room/use-space-room-selector';
import { useLogger } from '@pkgs/logger/solid';
import {
  ChessPuzzlePlayAttr,
  ChessPuzzleResultAttr,
} from '../chess-puzzle-play';
import {
  usePuzzleEntity,
  usePuzzleInteractions,
} from './chess-puzzle-play-queries';
import { useChessPuzzleInteractionWrites } from './use-chess-puzzle-interaction-writes';
import { usePuzzleResultRecorder } from './use-puzzle-result-recorder';

/** A result belongs to the account, even when it is viewing stats or settings. */
export function ReconcilePuzzleResult(): null {
  const myId = useMyId();
  const log = useLogger('chess-puzzle-result');
  const puzzleId = useSpaceRoomSelector(
    (state) => ChessPuzzlePlayAttr.puzzleId.from(state) ?? ''
  );
  const result = useSpaceRoomSelector((state) => ({
    owner: ChessPuzzleResultAttr.owner.from(state),
    attempt: ChessPuzzleResultAttr.attempt.from(state),
    outcome: ChessPuzzleResultAttr.outcome.from(state),
    score: ChessPuzzleResultAttr.score.from(state),
  }));
  const solveIdx = useSpaceRoomSelector(ChessPuzzlePlayAttr.solveIdx.from);
  const entity = usePuzzleEntity(puzzleId);
  const interactions = usePuzzleInteractions(puzzleId);
  const writes = useChessPuzzleInteractionWrites({
    puzzleId,
    puzzleRating: () => entity.rating,
    puzzleRatingDeviation: () => entity.ratingDeviation,
    solveIdx,
    interactions: interactions.rows,
    attemptKey: () => result().attempt,
  });
  usePuzzleResultRecorder({
    myId,
    recorder: {
      puzzleId,
      interactions: interactions.rows,
      interactionsReady: () => interactions.ready() && entity.fen.length > 0,
      canRecord: () => result().owner === myId(),
      result,
    },
    finalize: writes.finalizePlay,
    reportFailure: (error: unknown) =>
      log.error('puzzle result write failed', { puzzleId: puzzleId(), error }),
  });
  return null;
}
