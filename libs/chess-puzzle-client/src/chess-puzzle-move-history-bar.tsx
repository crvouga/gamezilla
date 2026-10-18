import { buildPuzzleMoveHistory } from '@libs/chess-puzzle-shared/chess-puzzle-move-history';
import { chessMoveNotationOf } from '@libs/chess-puzzle-shared/chess-puzzle-notation';
import { usePuzzleFeedConfig } from '@libs/game-puzzle-client/use-puzzle-feed-config';
import {
  PUZZLE_PLAY_STATUS,
  PuzzlePlayAttr,
} from '@libs/game-puzzle-shared/play-attr';
import { SeekPuzzlePlay } from '@libs/game-puzzle-shared/play-messages';
import type { PuzzleNavIntent } from '@libs/game-puzzle-shared/puzzle-nav';
import {
  puzzleNavFromState,
  resolvePuzzleNavTarget,
} from '@libs/game-puzzle-shared/puzzle-nav';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@libs/spaces-client/use-space-room-selector';
import { createMemo, type JSX } from 'solid-js';
import { ChessPuzzleMoveHistory } from './chess-puzzle-move-history';

export function ChessPuzzleMoveHistoryBar(): JSX.Element {
  const dispatch = useSpaceRoomDispatch();
  const [config] = usePuzzleFeedConfig();
  const fen = useSpaceRoomSelector(PuzzlePlayAttr.position.from);
  const moves = useSpaceRoomSelector(PuzzlePlayAttr.line.from);
  const solveIdx = useSpaceRoomSelector(PuzzlePlayAttr.solveIdx.from);
  const furthestSolveIdx = useSpaceRoomSelector(
    PuzzlePlayAttr.furthestSolveIdx.from
  );
  const status = useSpaceRoomSelector(PuzzlePlayAttr.status.from);

  const plies = createMemo(() =>
    buildPuzzleMoveHistory({
      fen: fen(),
      moves: moves(),
      throughIdx: furthestSolveIdx(),
    })
  );

  const interactive = createMemo(
    () =>
      status() === PUZZLE_PLAY_STATUS.solving ||
      status() === PUZZLE_PLAY_STATUS.solved ||
      status() === PUZZLE_PLAY_STATUS.revealed
  );

  const nav = createMemo(() =>
    puzzleNavFromState({
      status: status(),
      solveIdx: solveIdx(),
      furthestSolveIdx: furthestSolveIdx(),
      moves: moves(),
    })
  );

  const onSeek = (targetSolveIdx: number): void => {
    dispatch(SeekPuzzlePlay({ solveIdx: targetSolveIdx }));
  };

  const onNavigate = (intent: PuzzleNavIntent): void => {
    const target = resolvePuzzleNavTarget({
      intent,
      solveIdx: solveIdx(),
      furthestSolveIdx: furthestSolveIdx(),
    });
    if (target === null) return;
    onSeek(target);
  };

  return (
    <ChessPuzzleMoveHistory
      plies={plies()}
      selectedSolveIdx={solveIdx()}
      interactive={interactive()}
      notation={chessMoveNotationOf(config().notation)}
      onSeek={onSeek}
      nav={{
        canGoBack: nav().canGoBack,
        canGoForward: nav().canGoForward,
        // Back / Forward already live in the bottom action bar here.
        showStepControls: false,
        onNavigate,
      }}
    />
  );
}
