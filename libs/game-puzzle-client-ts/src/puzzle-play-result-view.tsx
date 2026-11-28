import { buildPuzzleActionBarPlan } from '@libs/game-puzzle-shared-ts/action-bar-plan';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { t } from '@lingui/core/macro';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { H2 } from '@pkgs/ui-root-client-ts/heading';
import {
  ChevronRightIcon,
  ChevronsRightIcon,
  ListOrderedIcon,
  RotateCcwIcon,
  ShareIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { Pressable } from '@pkgs/ui-root-client-ts/pressable';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import type { JSX } from '@solidjs/web';
import { createMemo, Match, Show, Switch } from 'solid-js';
import type { PuzzleStageScreenViewProps } from './puzzle-play-screen-model';
import { PuzzleRatingBadge } from './puzzle-rating-badge';
import { PuzzleSettingsRow } from './puzzle-settings-row';
import { PuzzleShareLabel } from './puzzle-share-label';
import { PuzzleSummaryCard } from './puzzle-summary-card';

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
        <Text variant="inherit" tone="reward">
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
    <StackHorizontal gap="sm">
      <Show when={props.result.puzzleRating > 0}>
        <PuzzleRatingBadge
          rating={props.result.puzzleRating}
          prefix={t`Puzzle`}
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

/**
 * A quiet command as its glyph on a disc with one word under it: short
 * enough to sit beside the wide command, plain enough to need no guessing.
 */
function LabeledGlyph(props: {
  readonly label: JSX.Element;
  readonly icon: typeof RotateCcwIcon;
  readonly onPress: () => void;
  readonly testid: string;
}): JSX.Element {
  const Icon = props.icon;
  return (
    <Pressable
      direction="vertical"
      align="center"
      radius="control"
      onPress={() => props.onPress()}
      testId={props.testid}
    >
      <StackVertical
        align="center"
        justify="center"
        width="auto"
        minHeight="row"
        paddingX="sm"
      >
        <Icon />
      </StackVertical>
      <Text variant="caption" tone="secondary">
        {props.label}
      </Text>
    </Pressable>
  );
}

/**
 * The glyphs and the one wide command, one layout at every width: the wide
 * command takes the column's width, its words never cut, and the captioned
 * glyphs spread under it.
 */
function ResultCommandLayout(props: {
  readonly glyphs: JSX.Element;
  readonly wide: JSX.Element;
}): JSX.Element {
  return (
    <StackVertical gap="sm">
      {props.wide}
      <StackHorizontal gap="md" align="center" justify="evenly">
        {props.glyphs}
      </StackHorizontal>
    </StackVertical>
  );
}

/**
 * What to do next, as the solve state allows it
 * (`buildPuzzleActionBarPlan`), with few words: retrying, stepping through
 * the line and sharing are glyphs with one word each, and the one wide,
 * filled command is the next puzzle (retrying, after a failed attempt,
 * when the next puzzle becomes a glyph of its own).
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
  const glyphs = (): JSX.Element => (
    <>
      <Show
        when={retryLeads()}
        fallback={
          <Show when={offers('retry')}>
            <LabeledGlyph
              label={<Trans>Retry</Trans>}
              icon={RotateCcwIcon}
              onPress={() => props.onRetry()}
              testid={Handles.chessPuzzleActionRetry}
            />
          </Show>
        }
      >
        <Show when={offers('next')}>
          <LabeledGlyph
            label={<Trans>Next</Trans>}
            icon={ChevronsRightIcon}
            onPress={() => props.onNext()}
            testid={Handles.chessPuzzleSummaryNext}
          />
        </Show>
      </Show>
      <LabeledGlyph
        label={<Trans>Moves</Trans>}
        icon={ListOrderedIcon}
        onPress={() => props.onOpen({ screen: 'line' })}
        testid={Handles.chessPuzzleSummaryClose}
      />
      <Show when={props.share} keyed>
        {(link) => (
          <LabeledGlyph
            label={<PuzzleShareLabel state={link.state} short />}
            icon={ShareIcon}
            onPress={() => link.onShare()}
            testid={Handles.chessPuzzleShareLink}
          />
        )}
      </Show>
    </>
  );
  return (
    <ResultCommandLayout
      glyphs={glyphs()}
      wide={
        <WideResultCommand
          {...props}
          retryLeads={retryLeads()}
          offersNext={offers('next')}
        />
      }
    />
  );
}

/** The one wide, filled command: the next puzzle, or Retry when it leads. */
function WideResultCommand(
  props: PuzzleStageScreenViewProps & {
    readonly retryLeads: boolean;
    readonly offersNext: boolean;
  }
): JSX.Element {
  return (
    <Show
      when={props.retryLeads}
      fallback={
        <Show when={props.offersNext}>
          <Button
            title={<Trans>Next puzzle</Trans>}
            size="lg"
            fullWidth
            endIcon={<ChevronRightIcon />}
            onClick={() => props.onNext()}
            dataSet={{ testid: Handles.chessPuzzleSummaryNext }}
          />
        </Show>
      }
    >
      <Button
        title={<Trans>Retry</Trans>}
        size="lg"
        fullWidth
        icon={RotateCcwIcon}
        onClick={() => props.onRetry()}
        dataSet={{ testid: Handles.chessPuzzleActionRetry }}
      />
    </Show>
  );
}

/**
 * The rating the finished puzzle made, in the one line over the board.
 */
export function PuzzleResultInfo(
  props: PuzzleStageScreenViewProps
): JSX.Element {
  return (
    // The rating the puzzle made first, then the puzzle's own facts, one
    // line that scrolls sideways when it runs long.
    <StackHorizontal align="center" gap="md">
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
    </StackHorizontal>
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
    </StackVertical>
  );
}
