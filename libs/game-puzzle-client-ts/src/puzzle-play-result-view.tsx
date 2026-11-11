import { buildPuzzleActionBarPlan } from '@libs/game-puzzle-shared-ts/action-bar-plan';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { EmbeddedScreen } from '@pkgs/ui-root-client-ts/embedded-screen';
import { GameResultHeadline } from '@pkgs/ui-root-client-ts/game-result';
import { GameActions } from '@pkgs/ui-root-client-ts/game-section';
import {
  ChevronRightIcon,
  RotateCcwIcon,
  ShareIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { createMemo, type JSX, Match, Show, Switch } from 'solid-js';
import type { PuzzlePlayScreenViewProps } from './puzzle-play-screen-model';
import { PuzzleRatingBadge } from './puzzle-rating-badge';
import { PuzzleSettingsRow } from './puzzle-settings-row';
import { PuzzleShareLabel } from './puzzle-share-label';
import { PuzzleSummaryCard } from './puzzle-summary-card';

function formatSignedDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}

/** How the puzzle ended, in the tone of its outcome. */
function ResultTitle(props: PuzzlePlayScreenViewProps): JSX.Element {
  return (
    <Switch fallback={<Trans>Puzzle skipped</Trans>}>
      <Match when={props.status === 'solved'}>
        <Text variant="inherit" tone="success">
          <Trans>Puzzle solved!</Trans>
        </Text>
      </Match>
      <Match when={props.status === 'revealed'}>
        <Trans>Solution shown</Trans>
      </Match>
    </Switch>
  );
}

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

/**
 * The puzzle's own facts, each a quiet tag: its rating, its themes, that
 * the attempt was a repeat, and the rating change of an attempt that has
 * no rated summary (a skip after a wrong move).
 */
function ResultFacts(props: PuzzlePlayScreenViewProps): JSX.Element {
  const themeLabel = (theme: string): string =>
    props.feed.themes?.label(theme) ?? theme;
  const change = (): number | null =>
    props.result.completion === null && typeof props.ratingChange === 'number'
      ? props.ratingChange
      : null;
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
      <Show when={props.ratingChange === 'unrated'}>
        <Badge
          intent="neutral"
          label={<Trans>Unrated</Trans>}
          dataSet={{ testid: Handles.chessPuzzleFeedUnratedLabel }}
        />
      </Show>
      <Show when={change()} keyed>
        {(delta) => (
          <Badge
            intent="neutral"
            label={formatSignedDelta(delta)}
            dataSet={{ testid: Handles.chessPuzzleFeedRatingChange }}
          />
        )}
      </Show>
    </StackHorizontal>
  );
}

/** Onward from the result: the line on the board, and the puzzle settings. */
function ResultRows(props: PuzzlePlayScreenViewProps): JSX.Element {
  return (
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
  );
}

/**
 * What to do next, as the solve state allows it
 * (`buildPuzzleActionBarPlan`): the next puzzle is the one filled command;
 * retrying and sharing the puzzle are quieter beside it.
 */
function ResultCommands(props: PuzzlePlayScreenViewProps): JSX.Element {
  const slots = createMemo(() =>
    buildPuzzleActionBarPlan({
      status: props.status,
      hintStage: props.hintStage,
      canGoForward: props.canGoForward,
    })
  );
  const offers = (id: 'next' | 'retry'): boolean =>
    slots().some((slot) => slot.id === id);
  return (
    <StackVertical gap="md">
      <Show when={offers('next')}>
        <Button
          title={<Trans>Next puzzle</Trans>}
          size="lg"
          fullWidth
          endIcon={<ChevronRightIcon />}
          onClick={() => props.onNext()}
          dataSet={{ testid: Handles.chessPuzzleSummaryNext }}
        />
      </Show>
      <GameActions sizing="share">
        <Show when={offers('retry')}>
          <Button
            title={<Trans>Retry</Trans>}
            intent="neutral"
            variant="outline"
            icon={RotateCcwIcon}
            onClick={() => props.onRetry()}
            dataSet={{ testid: Handles.chessPuzzleActionRetry }}
          />
        </Show>
        <Show when={props.share} keyed>
          {(share) => (
            <Button
              title={<PuzzleShareLabel state={share.state} />}
              intent="neutral"
              variant="outline"
              icon={ShareIcon}
              onClick={() => share.onShare()}
              dataSet={{ testid: Handles.chessPuzzleShareLink }}
            />
          )}
        </Show>
      </GameActions>
    </StackVertical>
  );
}

/**
 * The `result` place: how the finished puzzle went (solved, the solution
 * shown, skipped), the rating it made, and what next: the next puzzle,
 * a retry, or sharing it. Rows lead on to the line and the puzzle settings.
 */
export function PuzzlePlayResultView(
  props: PuzzlePlayScreenViewProps
): JSX.Element {
  return (
    <EmbeddedScreen
      screenId="chess-puzzle-result"
      title={<Trans>Puzzles</Trans>}
      dataSet={{ testid: Handles.chessPuzzleSummary, outcome: props.status }}
    >
      <StackVertical gap="xl">
        <StackVertical gap="lg" align="center">
          <GameResultHeadline
            title={<ResultTitle {...props} />}
            caption={<ResultCaption {...props} />}
          />
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
        <ResultCommands {...props} />
        <ResultRows {...props} />
      </StackVertical>
    </EmbeddedScreen>
  );
}
