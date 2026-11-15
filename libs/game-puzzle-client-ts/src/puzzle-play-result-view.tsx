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
  EllipsisIcon,
  ListOrderedIcon,
  RotateCcwIcon,
  ShareIcon,
  SlidersHorizontalIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import {
  type OverflowMenuAction,
  OverflowMenuButton,
} from '@pkgs/ui-root-client-ts/overflow-menu-button';
import { PuzzleScreenFold } from '@pkgs/ui-root-client-ts/puzzle-screen';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { createMemo, type JSX, Match, Show, Switch } from 'solid-js';
import type { PuzzlePlayScreenViewProps } from './puzzle-play-screen-model';
import { PuzzleSettingsRow } from './puzzle-settings-row';
import { PuzzleShareLabel } from './puzzle-share-label';
import { StatusLineTrailing } from './puzzle-status-line';
import { PuzzleSummaryCard } from './puzzle-summary-card';

/** How the puzzle ended, in the tone of its outcome. */
function ResultTitle(props: PuzzlePlayScreenViewProps): JSX.Element {
  return (
    <Switch fallback={<Trans>Puzzle skipped</Trans>}>
      {/* Finished after a wrong move: done, but not the clean solve the
          success colour would claim. */}
      <Match
        when={
          props.status === 'solved' &&
          props.result.completion?.outcome === 'failed'
        }
      >
        <Trans>Counts as failed</Trans>
      </Match>
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
        <Trans>You finished the line after a wrong move.</Trans>
      </Match>
      <Match
        when={
          props.status === 'solved' && props.result.completion?.rated === false
        }
      >
        <Trans>
          You found every move. Already played, so your rating stays.
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
 * The finished puzzle's own facts, one quiet line in the result's card:
 * its rating and its themes ("Puzzle 1702 · Checkmate, Opening").
 */
function ResultFacts(props: PuzzlePlayScreenViewProps): JSX.Element {
  const themeLabel = (theme: string): string =>
    props.feed.themes?.label(theme) ?? theme;
  const rated = (): boolean => props.result.puzzleRating > 0;
  const themed = (): boolean => props.result.themes.length > 0;
  return (
    <Show when={rated() || themed()}>
      <P variant="caption" tone="secondary">
        <Show when={rated()}>
          <Text variant="inherit" numeral testId={Handles.chessPuzzleBoardElo}>
            {t`Puzzle ${props.result.puzzleRating}`}
          </Text>
        </Show>
        <Show when={rated() && themed()}>{' · '}</Show>
        <Show when={themed()}>
          <Text variant="inherit" testId={Handles.chessPuzzleFeedPuzzleThemes}>
            {props.result.themes.map(themeLabel).join(', ')}
          </Text>
        </Show>
      </P>
    </Show>
  );
}

/** The streak a solve kept, under the rating it made. */
function ResultStreak(props: PuzzlePlayScreenViewProps): JSX.Element {
  const streak = (): number => props.result.completion?.streak ?? 0;
  return (
    <Show when={streak() > 1}>
      <P variant="caption" tone="success" numeral>
        <Trans>{streak()} in a row</Trans>
      </P>
    </Show>
  );
}

/** Onward from the result: the puzzle settings, under the commands. */
export function PuzzleResultRows(
  props: PuzzlePlayScreenViewProps
): JSX.Element {
  // A phone has the settings beside Next puzzle in the dock instead, so no
  // row is left cut under it.
  return (
    <PuzzleScreenFold on="wide">
      <StackVertical paddingX="lg">
        <MenuSection>
          <PuzzleSettingsRow
            feed={props.feed}
            allowanceLabel={props.allowanceLabel}
            onOpen={() => props.onOpen({ screen: 'feed' })}
          />
        </MenuSection>
      </StackVertical>
    </PuzzleScreenFold>
  );
}

/**
 * The puzzle's settings and its link under More, on a phone: one tap away,
 * so the feed can change before the next puzzle. Beside a wide board they
 * are in plain view (the settings row, Share) instead.
 */
function ResultMore(props: PuzzlePlayScreenViewProps): JSX.Element {
  const more = (): OverflowMenuAction[] => [
    {
      id: 'settings',
      label: <Trans>Puzzle settings</Trans>,
      icon: SlidersHorizontalIcon,
      onClick: () => props.onOpen({ screen: 'feed' }),
      dataSet: { testid: 'chess-puzzle-feed-summary-compact' },
    },
    ...(props.share === undefined || props.share === null
      ? []
      : [
          {
            id: 'share',
            label: <PuzzleShareLabel state={props.share.state} />,
            icon: ShareIcon,
            onClick: () => props.share?.onShare(),
            dataSet: { testid: Handles.chessPuzzleShareLink },
          },
        ]),
  ];
  return (
    <PuzzleScreenFold on="phone">
      <OverflowMenuButton
        aria-label={t`More for this puzzle`}
        placement="top-end"
        actions={more()}
        trigger={
          <Surface
            tone="background"
            radius="full"
            border
            paddingX="md"
            paddingY="sm"
            direction="horizontal"
            align="center"
            gap="xs"
          >
            <EllipsisIcon size={20} color="icon" />
            <Text variant="label">
              <Trans>More</Trans>
            </Text>
          </Surface>
        }
        dataSet={{ testid: 'chess-puzzle-result-more' }}
      />
    </PuzzleScreenFold>
  );
}

/** How copying the link went, on the dock: the menu closes as it is pressed. */
function ShareStatus(props: PuzzlePlayScreenViewProps): JSX.Element {
  return (
    <>
      <Show when={props.share?.state === 'copied'}>
        <P variant="caption" tone="success" role="status">
          <Trans>Puzzle link copied.</Trans>
        </P>
      </Show>
      <Show when={props.share?.state === 'failed' && props.share} keyed>
        {(share) => (
          <StackHorizontal gap="sm" align="center" wrap>
            <P variant="caption" tone="destructive" role="status">
              <Trans>Couldn't copy the link.</Trans>
            </P>
            <Button
              title={<Trans>Try again</Trans>}
              intent="neutral"
              variant="ghost"
              size="sm"
              onClick={() => share.onShare()}
              dataSet={{ testid: 'chess-puzzle-share-retry' }}
            />
          </StackHorizontal>
        )}
      </Show>
    </>
  );
}

/**
 * The result, docked in reach: how it went and the rating it made, then
 * what next (`buildPuzzleActionBarPlan`): the next puzzle is the one filled
 * command, with More (the puzzle settings, its link) beside it; on one line
 * under it, retrying and the moves of the line. Docked together, the
 * outcome and Next are in the first view on every phone.
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
        <StackHorizontal gap="sm" align="center">
          <StackVertical grow>
            <Button
              title={<Trans>Next puzzle</Trans>}
              fullWidth
              endIcon={<ChevronRightIcon />}
              onClick={() => props.onNext()}
              dataSet={{ testid: Handles.chessPuzzleSummaryNext }}
            />
          </StackVertical>
          <ResultMore {...props} />
        </StackHorizontal>
      </Show>
      <ShareStatus {...props} />
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
        <PuzzleScreenFold on="wide">
          <Show when={props.share} keyed>
            {(share) => (
              <Button
                title={<PuzzleShareLabel state={share.state} short />}
                intent="neutral"
                variant="outline"
                icon={ShareIcon}
                onClick={() => share.onShare()}
                dataSet={{ testid: 'chess-puzzle-share-link-wide' }}
              />
            )}
          </Show>
        </PuzzleScreenFold>
      </GameActions>
    </StackVertical>
  );
}

/**
 * The `result` place's card, docked under the board that keeps the
 * puzzle's last move: how it went (solved, the solution shown, skipped)
 * and why, the puzzle's own rating and themes, and beside that the rating
 * it made and the streak it kept. The status
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
      <StackHorizontal gap="md" align="start" justify="between">
        <StackVertical gap="xs" grow>
          <H2 size="heading">
            <ResultTitle {...props} />
          </H2>
          {/* The streak, the clock, and what a rating-less ending did (a
              skip's cost, an unrated repeat), one line under the outcome:
              the coach's line leaves them to the card. */}
          <StackHorizontal gap="sm" align="center" wrap>
            {/* A rating still settling says so, beside it, in words. */}
            <Show
              when={
                props.result.provisional && props.result.completion !== null
              }
            >
              <Badge
                intent="neutral"
                label={<Trans>Provisional rating</Trans>}
              />
            </Show>
            <ResultStreak {...props} />
            <StatusLineTrailing {...props} />
          </StackHorizontal>
          {/* A short phone keeps the outcome and the rating in view: the
              why and the puzzle's facts fold away there. */}
          <PuzzleScreenFold on="tall">
            <P variant="caption" tone="secondary">
              <ResultCaption {...props} />
            </P>
            <ResultFacts {...props} />
          </PuzzleScreenFold>
        </StackVertical>
        <StackVertical gap="none" align="end">
          <Show when={props.result.completion} keyed>
            {(completion) => (
              <PuzzleSummaryCard
                completion={completion}
                displayRating={props.result.displayRating}
                provisional={props.result.provisional}
              />
            )}
          </Show>
        </StackVertical>
      </StackHorizontal>
    </Surface>
  );
}
