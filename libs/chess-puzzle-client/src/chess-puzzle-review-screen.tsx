import type { ChessPuzzleGameLogEntry } from '@libs/chess-puzzle-shared/chess-puzzle-stats';
import {
  CHESS_SCREEN,
  ChessMainMenuScreenAttr,
  SeekChessPuzzleReview,
  SetChessMainMenuScreen,
  SetChessSelectedReviewPuzzle,
} from '@libs/chess-root-shared/chess-main-menu';
import { DefineBackButton } from '@libs/spaces-client/spaces-nav-context';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@libs/spaces-client/use-space-room-selector';
import { Trans } from '@lingui/solid/macro';
import { EmptyState } from '@pkgs/ui-root-client/empty-state';
import { GameReviewScreen } from '@pkgs/ui-root-client/game-review-screen';
import { createMemo, type JSX, Match, Show, Switch } from 'solid-js';
import { useReviewPuzzleEntity } from './chess-puzzle-play-queries';
import { ChessPuzzleReviewBoard } from './chess-puzzle-review-board';
import { useChessPuzzleHistory } from './use-chess-puzzle-history';
import type { PuzzleReviewCursor } from './use-puzzle-review-board';

/** How the reviewed attempt went; "Puzzle review" before the log has it. */
function ReviewTitle(props: {
  entry: ChessPuzzleGameLogEntry | null;
}): JSX.Element {
  return (
    <Switch fallback={<Trans>Puzzle review</Trans>}>
      <Match when={props.entry?.outcome === 'solved'}>
        <Trans>Solved</Trans>
      </Match>
      <Match when={props.entry?.outcome === 'failed'}>
        <Trans>Failed</Trans>
      </Match>
      <Match when={props.entry?.outcome === 'abandoned'}>
        <Trans>Abandoned</Trans>
      </Match>
    </Switch>
  );
}

/** The puzzle's own rating, once the puzzle is known. */
function ReviewSubtitle(props: { rating: number }): JSX.Element {
  return (
    <Show when={props.rating > 0}>
      <Trans>Puzzle rated {props.rating}</Trans>
    </Show>
  );
}

function findLogEntry(
  gameLog: readonly ChessPuzzleGameLogEntry[],
  puzzleId: string
): ChessPuzzleGameLogEntry | null {
  return gameLog.find((e) => e.puzzleId === puzzleId) ?? null;
}

export function ChessPuzzleReviewBody(props: {
  puzzleId: string;
  cursor: PuzzleReviewCursor;
}): JSX.Element {
  const entity = useReviewPuzzleEntity(() => props.puzzleId);
  const history = useChessPuzzleHistory();
  const entry = createMemo(() =>
    findLogEntry(history.gameLog(), props.puzzleId)
  );
  const hasPuzzle = () => entity.fen.length > 0 && entity.movesStr.length > 0;

  return (
    <GameReviewScreen
      screenId="chess-stats-review"
      title={<ReviewTitle entry={entry()} />}
      subtitle={
        entity.rating > 0 ? (
          <ReviewSubtitle rating={entity.rating} />
        ) : undefined
      }
    >
      <Show
        when={hasPuzzle()}
        fallback={
          <EmptyState
            title={<Trans>Puzzle unavailable</Trans>}
            body={
              <Trans>
                This puzzle is not in your local feed yet. Try again after sync.
              </Trans>
            }
          />
        }
      >
        <ChessPuzzleReviewBoard
          fen={entity.fen}
          moves={entity.movesStr}
          cursor={props.cursor}
        />
      </Show>
    </GameReviewScreen>
  );
}

export function ChessPuzzleReviewScreen(): JSX.Element {
  const dispatch = useSpaceRoomDispatch();
  const puzzleId = useSpaceRoomSelector(
    ChessMainMenuScreenAttr.selectedReviewPuzzleId.from
  );
  const cursor: PuzzleReviewCursor = {
    solveIdx: useSpaceRoomSelector(
      ChessMainMenuScreenAttr.selectedReviewSolveIdx.from
    ),
    seek: (solveIdx) => dispatch(SeekChessPuzzleReview({ solveIdx })),
  };

  const backToStats = (): void => {
    dispatch(SetChessSelectedReviewPuzzle({ puzzleId: null, solveIdx: 0 }));
    dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.stats }));
  };

  return (
    <div class="box flex-1 min-h-0 min-w-0 self-stretch overflow-hidden">
      <DefineBackButton onPress={backToStats} />
      <Show
        when={puzzleId() !== null}
        fallback={
          <EmptyState
            title={<Trans>No puzzle selected</Trans>}
            body={<Trans>Pick one from the game log.</Trans>}
          />
        }
      >
        <ChessPuzzleReviewBody puzzleId={puzzleId()!} cursor={cursor} />
      </Show>
    </div>
  );
}
