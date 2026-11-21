import { buildPuzzleActionBarPlan } from '@libs/game-puzzle-shared-ts/action-bar-plan';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import type {
  SpaceGameAction,
  SpaceGameResult,
} from '@pkgs/ui-root-client-ts/space-types';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { type Accessor, type JSX, Match, Show, Switch } from 'solid-js';
import type { PuzzlePlayScreenViewProps } from './puzzle-play-screen-model';
import { PuzzleRatingBadge } from './puzzle-rating-badge';
import { PuzzleSettingsRow } from './puzzle-settings-row';
import { usePuzzleShareLabel } from './puzzle-share-label';
import { PuzzleSummaryCard } from './puzzle-summary-card';

/** What the ending means for the attempt. */
function ResultCaption(props: PuzzlePlayScreenViewProps): JSX.Element {
  return (
    <Switch
      fallback={<Trans>You left this one. It stays in your game log.</Trans>}
    >
      <Match
        when={
          props.status === 'solved' &&
          props.result.completion?.outcome === 'failed'
        }
      >
        <Trans>
          Solved after a wrong move, so the attempt counts as failed.
        </Trans>
      </Match>
      <Match when={props.status === 'solved'}>
        <Trans>You found every move of the line.</Trans>
      </Match>
      <Match when={props.status === 'revealed'}>
        <Trans>The attempt counts as failed. Step through the line.</Trans>
      </Match>
    </Switch>
  );
}

/** The puzzle's own facts, each a quiet tag: its rating and its themes. */
function ResultFacts(props: PuzzlePlayScreenViewProps): JSX.Element {
  const { t } = useLingui();
  const themeLabel = (theme: string): string =>
    props.feed.themes?.label(theme) ?? theme;
  return (
    <StackHorizontal wrap gap="sm" justify="center">
      <Show when={props.result.puzzleRating > 0}>
        <PuzzleRatingBadge
          rating={props.result.puzzleRating}
          prefix={t`Puzzle rating`}
          testId={Handles.chessPuzzleBoardElo}
        />
      </Show>
      <Show when={props.result.themes.length > 0}>
        <Badge
          intent="neutral"
          label={props.result.themes.map(themeLabel).join(', ')}
          dataSet={{ testid: Handles.chessPuzzleFeedPuzzleThemes }}
        />
      </Show>
    </StackHorizontal>
  );
}

/** Onward from the result: the line on the board, and the puzzle settings. */
export function PuzzleResultRows(
  props: PuzzlePlayScreenViewProps
): JSX.Element {
  return (
    <StackVertical paddingX="lg">
      <MenuSection>
        <MenuRow
          title={<Trans>Step through the line</Trans>}
          onClick={() => props.onOpen({ screen: 'line' })}
          dataSet={{ testid: Handles.chessPuzzleSummaryClose }}
        />
        <PuzzleSettingsRow
          feed={props.feed}
          allowanceLabel={props.allowanceLabel}
          onOpen={() => props.onOpen({ screen: 'feed' })}
        />
      </MenuSection>
    </StackVertical>
  );
}

/**
 * How the puzzle ended and what to do next, as the solve state allows it
 * (`buildPuzzleActionBarPlan`), for the status line and the action bar:
 * the next puzzle is the one filled command; retrying and sharing the
 * puzzle are quieter beside it.
 */
export function usePuzzlePlayResult(
  view: () => PuzzlePlayScreenViewProps
): Accessor<SpaceGameResult> {
  const { t } = useLingui();
  const shareLabel = usePuzzleShareLabel();
  return () => {
    const props = view();
    const slots = buildPuzzleActionBarPlan({
      status: props.status,
      hintStage: props.hintStage,
      canGoForward: props.canGoForward,
    });
    const offers = (id: 'next' | 'retry'): boolean =>
      slots.some((slot) => slot.id === id);
    const share = props.share;
    const actions: SpaceGameAction[] = [];
    if (offers('next'))
      actions.push({
        id: 'next',
        label: t`Next puzzle`,
        emphasis: 'primary',
        onPress: () => props.onNext(),
        testId: Handles.chessPuzzleSummaryNext,
      });
    if (offers('retry'))
      actions.push({
        id: 'retry',
        label: t`Retry`,
        onPress: () => props.onRetry(),
        testId: Handles.chessPuzzleActionRetry,
      });
    if (share !== null)
      actions.push({
        id: 'share',
        label: shareLabel(share.state),
        onPress: () => share.onShare(),
        testId: Handles.chessPuzzleShareLink,
      });
    return {
      status:
        props.status === 'solved'
          ? t`Puzzle solved!`
          : props.status === 'revealed'
            ? t`Solution shown`
            : t`Puzzle skipped`,
      actions,
    };
  };
}

/**
 * The `result` place, under the board that keeps the puzzle's last move:
 * how it went (solved, the solution shown, skipped), the rating it made,
 * and what next. The status line over the board carries the coach's words
 * about it, and what the attempt did to the rating when it has no rated
 * summary (a skip).
 */
export function PuzzleResultSummary(
  props: PuzzlePlayScreenViewProps
): JSX.Element {
  return (
    <StackVertical
      paddingX="lg"
      gap="lg"
      dataSet={{ testid: Handles.chessPuzzleSummary, outcome: props.status }}
    >
      <StackVertical gap="md" align="center">
        <P variant="caption" tone="secondary" align="center">
          <ResultCaption {...props} />
        </P>
        <Show when={props.result.completion} keyed>
          {(completion) => (
            <PuzzleSummaryCard
              completion={completion}
              displayRating={props.result.displayRating}
              provisional={props.result.provisional}
            />
          )}
        </Show>
        <ResultFacts {...props} />
      </StackVertical>
    </StackVertical>
  );
}
