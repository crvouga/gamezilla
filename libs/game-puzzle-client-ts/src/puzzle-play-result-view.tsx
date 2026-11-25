import { buildPuzzleActionBarPlan } from '@libs/game-puzzle-shared-ts/action-bar-plan';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { H2 } from '@pkgs/ui-root-client-ts/heading';
import { IconButton } from '@pkgs/ui-root-client-ts/icon-button';
import {
  ChevronRightIcon,
  ListOrderedIcon,
  RotateCcwIcon,
  ShareIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import { createMemo, type JSX, Match, Show, Switch } from 'solid-js';
import type { PuzzleStageScreenViewProps } from './puzzle-play-screen-model';
import { PuzzleRatingBadge } from './puzzle-rating-badge';
import { PuzzleSettingsRow } from './puzzle-settings-row';
import { PuzzleShareLabel } from './puzzle-share-label';
import { PuzzleSummaryCard } from './puzzle-summary-card';

/** A glyph command's disc: a tap target as tall as the wide command. */
const GLYPH_SIZE = 48;

/** How the puzzle ended, in the tone of its outcome. */
function ResultTitle(props: PuzzleStageScreenViewProps): JSX.Element {
  return (
    <Switch fallback={<Trans>Puzzle skipped</Trans>}>
      {/* Found only after a wrong move: one outcome, said once. */}
      <Match
        when={
          props.status === 'solved' &&
          props.result.completion?.outcome === 'failed'
        }
      >
        {/* The line above leads with how it was solved; this says what
            it counts as. */}
        <Trans>Attempt recorded as failed</Trans>
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
function ResultCaption(props: PuzzleStageScreenViewProps): JSX.Element {
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
          A wrong move on the way counts the attempt as failed, even when the
          line is finished. Retry to solve it cleanly.
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
function ResultFacts(props: PuzzleStageScreenViewProps): JSX.Element {
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
  props: PuzzleStageScreenViewProps
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

/** A command as a glyph on a disc as tall as the wide command. */
function glyph(
  label: string,
  Icon: typeof RotateCcwIcon,
  onClick: () => void,
  testid: string
): JSX.Element {
  return (
    <IconButton
      label={label}
      size={GLYPH_SIZE}
      background="surfaceMuted"
      onClick={onClick}
      dataSet={{ testid }}
    >
      <Icon />
    </IconButton>
  );
}

/**
 * What to do next, as the solve state allows it
 * (`buildPuzzleActionBarPlan`), in one row with few words: retrying and
 * stepping through the line are glyphs, and the one wide, filled command
 * is the next puzzle (retrying, after a failed attempt). Sharing waits as a
 * quiet glyph under them.
 */
function ResultCommands(props: PuzzleStageScreenViewProps): JSX.Element {
  const slots = createMemo(() =>
    buildPuzzleActionBarPlan({
      status: props.status,
      hintStage: props.hintStage,
      canGoForward: props.canGoForward,
    })
  );
  const offers = (id: 'next' | 'retry'): boolean =>
    slots().some((slot) => slot.id === id);
  // After a failed attempt the coach says retry: Retry is the wide one.
  const retryLeads = (): boolean =>
    offers('retry') &&
    props.status === 'solved' &&
    props.result.completion?.outcome === 'failed';
  return (
    <StackVertical gap="sm">
      <StackHorizontal gap="sm" align="center">
        <Show
          when={retryLeads()}
          fallback={
            <>
              <Show when={offers('retry')}>
                {glyph(
                  t`Retry`,
                  RotateCcwIcon,
                  () => props.onRetry(),
                  Handles.chessPuzzleActionRetry
                )}
              </Show>
              {glyph(
                t`Step through the line`,
                ListOrderedIcon,
                () => props.onOpen({ screen: 'line' }),
                Handles.chessPuzzleSummaryClose
              )}
              <Show when={offers('next')}>
                <Button
                  title={<Trans>Next puzzle</Trans>}
                  size="lg"
                  flex={1}
                  endIcon={<ChevronRightIcon />}
                  onClick={() => props.onNext()}
                  dataSet={{ testid: Handles.chessPuzzleSummaryNext }}
                />
              </Show>
            </>
          }
        >
          {glyph(
            t`Step through the line`,
            ListOrderedIcon,
            () => props.onOpen({ screen: 'line' }),
            Handles.chessPuzzleSummaryClose
          )}
          <Show when={offers('next')}>
            {glyph(
              t`Next puzzle`,
              ChevronRightIcon,
              () => props.onNext(),
              Handles.chessPuzzleSummaryNext
            )}
          </Show>
          <Button
            title={<Trans>Retry</Trans>}
            size="lg"
            flex={1}
            icon={RotateCcwIcon}
            onClick={() => props.onRetry()}
            dataSet={{ testid: Handles.chessPuzzleActionRetry }}
          />
        </Show>
      </StackHorizontal>
      <Show when={props.share} keyed>
        {(link) => (
          <StackHorizontal align="center" gap="xs">
            <IconButton
              label={<PuzzleShareLabel state={link.state} short />}
              size={40}
              onClick={() => link.onShare()}
              dataSet={{ testid: Handles.chessPuzzleShareLink }}
            >
              <ShareIcon />
            </IconButton>
          </StackHorizontal>
        )}
      </Show>
    </StackVertical>
  );
}

/**
 * The `result` place, under the board that keeps the puzzle's last move:
 * how it went (solved, the solution shown, skipped), the rating it made,
 * and what next. The status line over the board carries the coach's words
 * about it, and what the attempt did to the rating when it has no rated
 * summary (a skip).
 */
export function PuzzleResultSummary(
  props: PuzzleStageScreenViewProps
): JSX.Element {
  return (
    <StackVertical
      paddingX="lg"
      gap="lg"
      dataSet={{ testid: Handles.chessPuzzleSummary, outcome: props.status }}
    >
      {/* The status line and the coach already say how it went: the
          result says only what it means for the attempt, once. */}
      <VisuallyHidden>
        <H2 size="heading">
          <ResultTitle {...props} />
        </H2>
      </VisuallyHidden>
      {/* The coach over the board says how it went in a few words; what
          it means for the attempt is for a listener. */}
      <VisuallyHidden>
        <ResultCaption {...props} />
      </VisuallyHidden>
      {/* What next comes straight after how it went, so on a phone Next
          puzzle is in view without scrolling; the numbers follow. */}
      <ResultCommands {...props} />
      <StackVertical gap="md" align="center">
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
