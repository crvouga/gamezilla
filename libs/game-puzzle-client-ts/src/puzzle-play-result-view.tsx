import { buildPuzzleActionBarPlan } from '@libs/game-puzzle-shared-ts/action-bar-plan';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameActions } from '@pkgs/ui-root-client-ts/game-section';
import { H2 } from '@pkgs/ui-root-client-ts/heading';
import {
  ChevronRightIcon,
  ListOrderedIcon,
  RotateCcwIcon,
  ShareIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { createMemo, type JSX, Match, Show, Switch } from 'solid-js';
import type { PuzzlePlayScreenViewProps } from './puzzle-play-screen-model';
import { PuzzleRatingBadge } from './puzzle-rating-badge';
import { PuzzleSettingsRow } from './puzzle-settings-row';
import { PuzzleShareLabel } from './puzzle-share-label';
import { PuzzleSummaryCard } from './puzzle-summary-card';

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

/** The puzzle's own facts, each a quiet tag: the streak it kept, its rating and its themes. */
function ResultFacts(props: PuzzlePlayScreenViewProps): JSX.Element {
  const themeLabel = (theme: string): string =>
    props.feed.themes?.label(theme) ?? theme;
  const streak = (): number => props.result.completion?.streak ?? 0;
  return (
    <StackHorizontal wrap gap="sm">
      <Show when={streak() > 1}>
        <Badge
          intent="success"
          label={<Trans>{streak()} puzzle streak</Trans>}
        />
      </Show>
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

/** Onward from the result: the puzzle settings, under the commands. */
export function PuzzleResultRows(
  props: PuzzlePlayScreenViewProps
): JSX.Element {
  return (
    <StackVertical paddingX="lg">
      <MenuSection>
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
 * The result, docked in reach: how it went and the rating it made, then
 * what next (`buildPuzzleActionBarPlan`): the next puzzle is the one filled
 * command; on one line under it, retrying, the moves of the line and
 * sharing the puzzle. Docked together, the outcome and Next are in the
 * first view on every phone.
 */
export function PuzzleResultDock(
  props: PuzzlePlayScreenViewProps
): JSX.Element {
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
    <StackVertical gap="sm">
      <PuzzleResultSummary {...props} />
      <Show when={offers('next')}>
        <Button
          title={<Trans>Next puzzle</Trans>}
          fullWidth
          endIcon={<ChevronRightIcon />}
          onClick={() => props.onNext()}
          dataSet={{ testid: Handles.chessPuzzleSummaryNext }}
        />
      </Show>
      <GameActions sizing="fill">
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
        <Button
          title={<Trans>Moves</Trans>}
          intent="neutral"
          variant="outline"
          icon={ListOrderedIcon}
          onClick={() => props.onOpen({ screen: 'line' })}
          dataSet={{ testid: Handles.chessPuzzleSummaryClose }}
        />
        <Show when={props.share} keyed>
          {(share) => (
            <Button
              title={<PuzzleShareLabel state={share.state} short />}
              intent="neutral"
              variant="outline"
              icon={ShareIcon}
              onClick={() => share.onShare()}
              dataSet={{ testid: Handles.chessPuzzleShareLink }}
            />
          )}
        </Show>
      </GameActions>
      <Show when={props.share?.state === 'failed'}>
        <P variant="caption" tone="destructive" role="status">
          <Trans>Couldn't copy the link. Press Share to try again.</Trans>
        </P>
      </Show>
    </StackVertical>
  );
}

/**
 * The `result` place's card, under the board that keeps the puzzle's last
 * move: how it went (solved, the solution shown, skipped) and why, the
 * rating it made beside that, and the puzzle's facts under it. The status
 * line over the board carries the coach's words about it, and what the
 * attempt did to the rating when it has no rated summary (a skip).
 */
function PuzzleResultSummary(props: PuzzlePlayScreenViewProps): JSX.Element {
  return (
    <Surface
      tone="muted"
      radius="card"
      padding="sm"
      gap="xs"
      dataSet={{ testid: Handles.chessPuzzleSummary, outcome: props.status }}
    >
      <StackHorizontal gap="md" align="center" justify="between">
        <StackVertical gap="xs" grow>
          <H2 size="heading">
            <ResultTitle {...props} />
          </H2>
          <P variant="caption" tone="secondary">
            <ResultCaption {...props} />
          </P>
        </StackVertical>
        <Show when={props.result.completion} keyed>
          {(completion) => (
            <PuzzleSummaryCard
              completion={completion}
              displayRating={props.result.displayRating}
              provisional={props.result.provisional}
            />
          )}
        </Show>
      </StackHorizontal>
      <ResultFacts {...props} />
    </Surface>
  );
}
