import { DefineBackButton } from '@libs/spaces/public/nav/spaces-nav-context';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@libs/spaces/public/room/use-space-room-selector';
import { Trans } from '@lingui/react/macro';
import {
  Box,
  componentDataSet,
  EmptyState,
  MainMenuScreenHeader,
} from '@pkgs/ui-rn';
import { type ReactNode, useCallback, useMemo } from 'react';

import {
  CHESS_SCREEN,
  ChessMainMenuScreenAttr,
  SetChessMainMenuScreen,
  SetChessSelectedReviewPuzzle,
} from '../chess-main-menu';
import type { ChessPuzzleGameLogEntry } from '../chess-puzzle-stats';
import { usePuzzleEntity } from './chess-puzzle-play-queries';
import { ChessPuzzleReviewBoard } from './chess-puzzle-review-board';
import { useChessPuzzleHistory } from './use-chess-puzzle-history';

function ReviewTitle({
  entry,
}: {
  entry: ChessPuzzleGameLogEntry | null;
}): ReactNode {
  if (entry === null) return <Trans>Puzzle review</Trans>;
  const puzzleRating = entry.puzzleRating;
  if (entry.outcome === 'solved') {
    return <Trans>Solved · {puzzleRating}</Trans>;
  }
  return <Trans>Abandoned · {puzzleRating}</Trans>;
}

function ReviewSubtitle({
  puzzleId,
  rating,
}: {
  puzzleId: string;
  rating: number;
}): ReactNode {
  if (rating > 0) {
    return (
      <Trans>
        {puzzleId} · {rating}
      </Trans>
    );
  }
  return puzzleId;
}

function findLogEntry(
  gameLog: readonly ChessPuzzleGameLogEntry[],
  puzzleId: string
): ChessPuzzleGameLogEntry | null {
  return gameLog.find((e) => e.puzzleId === puzzleId) ?? null;
}

function ChessPuzzleReviewBody({ puzzleId }: { puzzleId: string }): ReactNode {
  const { fen, movesStr, rating } = usePuzzleEntity(puzzleId);
  const { gameLog } = useChessPuzzleHistory();
  const entry = useMemo(
    () => findLogEntry(gameLog, puzzleId),
    [gameLog, puzzleId]
  );
  const hasPuzzle = fen.length > 0 && movesStr.length > 0;

  return (
    <Box
      sx={{ flex: 1, minHeight: 0, alignSelf: 'stretch', gap: 4, p: 4, pb: 8 }}
      {...componentDataSet('ChessPuzzleReviewScreen', {
        screen: 'chess-stats-review',
      })}
    >
      <MainMenuScreenHeader
        title={<ReviewTitle entry={entry} />}
        subtitle={<ReviewSubtitle puzzleId={puzzleId} rating={rating} />}
      />
      {hasPuzzle ? (
        <ChessPuzzleReviewBoard fen={fen} moves={movesStr} />
      ) : (
        <EmptyState
          title={<Trans>Puzzle unavailable</Trans>}
          body={
            <Trans>
              This puzzle is not in your local feed yet. Try again after sync.
            </Trans>
          }
        />
      )}
    </Box>
  );
}

export function ChessPuzzleReviewScreen(): ReactNode {
  const dispatch = useSpaceRoomDispatch();
  const puzzleId = useSpaceRoomSelector(
    ChessMainMenuScreenAttr.selectedReviewPuzzleId.from
  );

  const backToStats = useCallback(() => {
    dispatch(SetChessSelectedReviewPuzzle({ puzzleId: null, solveIdx: 0 }));
    dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.stats }));
  }, [dispatch]);

  return (
    <Box sx={{ flex: 1, minHeight: 0, alignSelf: 'stretch' }}>
      <DefineBackButton onPress={backToStats} />
      {puzzleId === null ? (
        <EmptyState
          title={<Trans>No puzzle selected</Trans>}
          body={<Trans>Pick one from the game log.</Trans>}
        />
      ) : (
        <ChessPuzzleReviewBody puzzleId={puzzleId} />
      )}
    </Box>
  );
}
