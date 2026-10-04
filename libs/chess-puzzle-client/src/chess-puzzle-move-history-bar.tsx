import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@libs/spaces-client/use-space-room-selector';
import { createMemo, type JSX } from 'solid-js';

import type { PuzzleNavIntent } from '@libs/chess-puzzle-shared/puzzle-nav';
import { puzzleNavFromState, resolvePuzzleNavTarget } from '@libs/chess-puzzle-shared/puzzle-nav';
import { buildPuzzleMoveHistory } from '@libs/chess-puzzle-shared/chess-puzzle-move-history';
import { CHESS_PUZZLE_PLAY_STATUS, ChessPuzzlePlayAttr } from '@libs/chess-puzzle-shared/chess-puzzle-play-attr';
import { SeekChessPuzzlePlay } from '@libs/chess-puzzle-shared/chess-puzzle-play-messages';
import { ChessPuzzleMoveHistory } from './chess-puzzle-move-history';
import { useChessPuzzleFeedConfig } from './use-chess-puzzle-feed-config';

export function ChessPuzzleMoveHistoryBar(): JSX.Element {
  const dispatch = useSpaceRoomDispatch();
  const [config] = useChessPuzzleFeedConfig();
  const fen = useSpaceRoomSelector(ChessPuzzlePlayAttr.fen.from);
  const moves = useSpaceRoomSelector(ChessPuzzlePlayAttr.moves.from);
  const solveIdx = useSpaceRoomSelector(ChessPuzzlePlayAttr.solveIdx.from);
  const furthestSolveIdx = useSpaceRoomSelector(
    ChessPuzzlePlayAttr.furthestSolveIdx.from
  );
  const status = useSpaceRoomSelector(ChessPuzzlePlayAttr.status.from);

  const plies = createMemo(() =>
    buildPuzzleMoveHistory({
      fen: fen(),
      moves: moves(),
      throughIdx: furthestSolveIdx(),
    })
  );

  const interactive = createMemo(
    () =>
      status() === CHESS_PUZZLE_PLAY_STATUS.solving ||
      status() === CHESS_PUZZLE_PLAY_STATUS.solved ||
      status() === CHESS_PUZZLE_PLAY_STATUS.revealed
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
    dispatch(SeekChessPuzzlePlay({ solveIdx: targetSolveIdx }));
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
      notation={config().notation}
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
