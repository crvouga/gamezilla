import { DefineBackButton } from '@libs/spaces-client/spaces-nav-context';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@libs/spaces-client/use-space-room-selector';
import { Trans } from '@lingui/solid/macro';
import { EmptyState } from '@pkgs/ui-client/empty-state';
import { MAIN_MENU_SCREEN_MAX_WIDTH } from '@pkgs/ui-client/main-menu-screen';
import { MainMenuScreenHeader } from '@pkgs/ui-client/main-menu-screen-header';
import { ScrollView } from '@pkgs/ui-client/scroll-view';
import { createMemo, type JSX, Show } from 'solid-js';

import { CHESS_SCREEN, ChessMainMenuScreenAttr, SetChessMainMenuScreen, SetChessSelectedReviewPuzzle } from '@libs/chess-shared/chess-main-menu';
import type { ChessPuzzleGameLogEntry } from '@libs/chess-puzzle-shared/chess-puzzle-stats';
import { useReviewPuzzleEntity } from './chess-puzzle-play-queries';
import { ChessPuzzleReviewBoard } from './chess-puzzle-review-board';
import { useChessPuzzleHistory } from './use-chess-puzzle-history';

function ReviewTitle(props: {
  entry: ChessPuzzleGameLogEntry | null;
}): JSX.Element {
  if (props.entry === null) return <Trans>Puzzle review</Trans>;
  const puzzleRating = props.entry.puzzleRating;
  if (props.entry.outcome === 'solved') {
    return <Trans>Solved · {puzzleRating}</Trans>;
  }
  if (props.entry.outcome === 'failed') {
    return <Trans>Failed · {puzzleRating}</Trans>;
  }
  return <Trans>Abandoned · {puzzleRating}</Trans>;
}

function ReviewSubtitle(props: {
  puzzleId: string;
  rating: number;
}): JSX.Element {
  if (props.rating > 0) {
    return (
      <Trans>
        {props.puzzleId} · {props.rating}
      </Trans>
    );
  }
  return <>{props.puzzleId}</>;
}

function findLogEntry(
  gameLog: readonly ChessPuzzleGameLogEntry[],
  puzzleId: string
): ChessPuzzleGameLogEntry | null {
  return gameLog.find((e) => e.puzzleId === puzzleId) ?? null;
}

function ChessPuzzleReviewBody(props: { puzzleId: string }): JSX.Element {
  const entity = useReviewPuzzleEntity(() => props.puzzleId);
  const history = useChessPuzzleHistory();
  const entry = createMemo(() =>
    findLogEntry(history.gameLog(), props.puzzleId)
  );
  const hasPuzzle = () => entity.fen.length > 0 && entity.movesStr.length > 0;

  return (
    <ScrollView
      contentClass="box flex-1 self-stretch"
      dataSet={{ screen: 'chess-stats-review' }}
    >
      <div
        class="box gap-4 p-4 pb-8 self-center w-full min-w-0"
        style={{ 'max-width': `${MAIN_MENU_SCREEN_MAX_WIDTH}px` }}
      >
        <MainMenuScreenHeader
          title={<ReviewTitle entry={entry()} />}
          subtitle={
            <ReviewSubtitle puzzleId={props.puzzleId} rating={entity.rating} />
          }
        />
        <Show
          when={hasPuzzle()}
          fallback={
            <EmptyState
              title={<Trans>Puzzle unavailable</Trans>}
              body={
                <Trans>
                  This puzzle is not in your local feed yet. Try again after
                  sync.
                </Trans>
              }
            />
          }
        >
          <ChessPuzzleReviewBoard fen={entity.fen} moves={entity.movesStr} />
        </Show>
      </div>
    </ScrollView>
  );
}

export function ChessPuzzleReviewScreen(): JSX.Element {
  const dispatch = useSpaceRoomDispatch();
  const puzzleId = useSpaceRoomSelector(
    ChessMainMenuScreenAttr.selectedReviewPuzzleId.from
  );

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
        <ChessPuzzleReviewBody puzzleId={puzzleId()!} />
      </Show>
    </div>
  );
}
