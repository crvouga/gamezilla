import {
  PuzzleReviewAttr,
  SeekPuzzleReview,
  SelectReviewPuzzle,
} from '@libs/game-puzzle-shared-ts/puzzle-review-selection';
import { DefineBackButton } from '@libs/spaces-client-ts/spaces-nav-context';
import { useGameScreen } from '@libs/spaces-client-ts/use-game-screen';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@libs/spaces-client-ts/use-space-room-selector';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { createMemo, type JSX, Show } from 'solid-js';
import { useReviewPuzzleEntity } from './puzzle-play-queries';
import { PuzzleReviewBoard } from './puzzle-review-board';
import { PuzzleReviewScreenView } from './puzzle-review-screen-view';
import { PUZZLE_SCREEN } from './puzzle-screens';
import { usePuzzleHistory } from './use-puzzle-history';
import type { PuzzleReviewCursor } from './use-puzzle-review-board';

/** One logged puzzle's review, wired to the synced puzzle and game log. */
export function PuzzleReviewBody(props: {
  puzzleId: string;
  cursor: PuzzleReviewCursor;
  /** The host already scrolls and pads the page (the personal stats route). */
  nested?: boolean;
}): JSX.Element {
  const entity = useReviewPuzzleEntity(() => props.puzzleId);
  const history = usePuzzleHistory();
  const entry = createMemo(
    () => history.gameLog().find((e) => e.puzzleId === props.puzzleId) ?? null
  );
  const hasPuzzle = () => entity.fen.length > 0 && entity.movesStr.length > 0;
  return (
    <PuzzleReviewScreenView
      status={hasPuzzle() ? 'ready' : 'unavailable'}
      outcome={entry()?.outcome ?? null}
      puzzleRating={entity.rating}
      nested={props.nested}
      board={
        <PuzzleReviewBoard
          fen={entity.fen}
          moves={entity.movesStr}
          cursor={props.cursor}
        />
      }
    />
  );
}

export function PuzzleReviewScreen(): JSX.Element {
  const dispatch = useSpaceRoomDispatch();
  const gameScreen = useGameScreen();
  const puzzleId = useSpaceRoomSelector(
    PuzzleReviewAttr.selectedReviewPuzzleId.from
  );
  const cursor: PuzzleReviewCursor = {
    solveIdx: useSpaceRoomSelector(
      PuzzleReviewAttr.selectedReviewSolveIdx.from
    ),
    seek: (solveIdx) => dispatch(SeekPuzzleReview({ solveIdx })),
  };

  const backToStats = (): void => {
    dispatch(SelectReviewPuzzle({ puzzleId: null, solveIdx: 0 }));
    gameScreen.show(PUZZLE_SCREEN.stats);
  };

  return (
    <StackVertical grow self="stretch" overflow="hidden">
      <DefineBackButton onPress={backToStats} />
      <Show
        when={puzzleId()}
        keyed
        fallback={
          <PuzzleReviewScreenView status="unselected" puzzleRating={0} />
        }
      >
        {(id) => <PuzzleReviewBody puzzleId={id} cursor={cursor} />}
      </Show>
    </StackVertical>
  );
}
