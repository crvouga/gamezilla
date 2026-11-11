import { SelectReviewPuzzle } from '@libs/game-puzzle-shared-ts/puzzle-review-selection';
import type { PuzzleGameLogEntry } from '@libs/game-puzzle-shared-ts/stats';
import {
  DefineBackButton,
  useGameChoicesName,
} from '@libs/spaces-client-ts/spaces-nav-context';
import { useGameScreen } from '@libs/spaces-client-ts/use-game-screen';
import { useSpaceRoomDispatch } from '@libs/spaces-client-ts/use-space-room-selector';
import { t } from '@lingui/core/macro';
import { createComputed, createMemo, type JSX } from 'solid-js';
import { PUZZLE_SCREEN } from './puzzle-screens';
import {
  PUZZLE_STATS_PLACES,
  type PuzzleStatsStage,
  puzzleStatsStageOf,
} from './puzzle-stats-places';
import { PuzzleStatsReturnContext } from './puzzle-stats-return';
import { PuzzleStatsScreenView } from './puzzle-stats-screen-view';
import { useEnteredPlace } from './use-entered-place';
import { usePuzzleHistory } from './use-puzzle-history';

/**
 * A game's puzzle stats in a space: the stats' place machine over the
 * player's synced history. A row of the log opens that puzzle's review,
 * the space's own screen; coming back from it returns to the log.
 */
export function PuzzleStatsScreen(): JSX.Element {
  const dispatch = useSpaceRoomDispatch();
  const gameScreen = useGameScreen();
  const choices = useGameChoicesName();
  const history = usePuzzleHistory();
  const returning = PuzzleStatsReturnContext.useOptional();
  const stage = createMemo<PuzzleStatsStage>(() =>
    puzzleStatsStageOf({ loading: history.loading() })
  );
  const nav = useEnteredPlace(PUZZLE_STATS_PLACES, stage);
  // Back from a review opened here: the log it was opened from.
  createComputed(() => {
    if (stage() !== 'ready' || returning?.toLog !== true) return;
    returning.toLog = false;
    nav.open({ screen: 'log' });
  });
  const atHome = (): boolean => nav.place().screen === 'summary';

  const back = (): void => {
    if (!nav.back()) gameScreen.showChoices();
  };

  const openReview = (entry: PuzzleGameLogEntry): void => {
    if (returning !== undefined) returning.toLog = true;
    dispatch(
      SelectReviewPuzzle({
        puzzleId: entry.puzzleId,
        solveIdx: 0,
      })
    );
    gameScreen.show(PUZZLE_SCREEN.review);
  };

  return (
    <>
      <DefineBackButton
        onPress={back}
        label={atHome() ? choices() : t`Puzzle stats`}
      />
      <PuzzleStatsScreenView
        stage={stage()}
        place={nav.place()}
        onOpen={nav.open}
        stats={history.stats()}
        gameLog={history.gameLog()}
        onSelectEntry={openReview}
      />
    </>
  );
}
