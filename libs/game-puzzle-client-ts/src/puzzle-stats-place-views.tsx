import { formatPuzzleRating } from '@libs/game-puzzle-shared-ts/rating';
import type { PuzzleGameLogEntry } from '@libs/game-puzzle-shared-ts/stats';
import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { EmbeddedScreen } from '@pkgs/ui-root-client-ts/embedded-screen';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { H2 } from '@pkgs/ui-root-client-ts/heading';
import { ActivityIcon } from '@pkgs/ui-root-client-ts/icons';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { Sparkline } from '@pkgs/ui-root-client-ts/sparkline';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Match, Show, Switch } from 'solid-js';
import { PuzzleGameLog } from './puzzle-game-log';
import { PuzzleRatingHistory } from './puzzle-rating-history';
import { PuzzleStatsCards } from './puzzle-stats-cards';
import type { PuzzleStatsScreenViewProps } from './puzzle-stats-screen-view';

/** One end of the chart's scale: what the edge is, and its value. */
function ScaleEnd(props: {
  readonly edge: JSX.Element;
  readonly value: JSX.Element;
}): JSX.Element {
  return (
    <StackHorizontal justify="between">
      <P variant="caption" tone="secondary">
        {props.edge}
      </P>
      <P variant="caption" tone="secondary" numeral>
        {props.value}
      </P>
    </StackHorizontal>
  );
}

/**
 * The rating trend with its scale in words, as a chart's axes: the highest
 * rating on its top edge, the lowest on its bottom, oldest puzzle on the
 * left and latest on the right.
 */
function TrendChart(props: {
  readonly series: readonly number[];
}): JSX.Element {
  const low = (): number => Math.min(...props.series);
  const high = (): number => Math.max(...props.series);
  return (
    <StackVertical width="full" maxWidth="form" self="center" gap="xs">
      <ScaleEnd
        edge={<Trans>Your rating</Trans>}
        value={<Trans>High {high()}</Trans>}
      />
      <Sparkline
        values={props.series}
        size="lg"
        testId="chess-stats-sparkline"
      />
      <ScaleEnd
        edge={<Trans>Oldest puzzle → latest</Trans>}
        value={<Trans>Low {low()}</Trans>}
      />
    </StackVertical>
  );
}

/** Where nothing is played or rated yet: straight back to the puzzles. */
function solveAction(
  onPlay: (() => void) | undefined
): { label: JSX.Element; onClick: () => void } | undefined {
  return onPlay === undefined
    ? undefined
    : { label: <Trans>Solve a puzzle</Trans>, onClick: onPlay };
}

/** A screen's own title, unless the host's bar already names it. */
function titleOf(
  props: PuzzleStatsScreenViewProps,
  title: () => JSX.Element
): JSX.Element | undefined {
  return props.titled === false ? undefined : title();
}

/** The headline: the player's puzzle rating, and how it has moved. */
function StatsRating(props: PuzzleStatsScreenViewProps): JSX.Element {
  return (
    <StackVertical align="center" gap="sm">
      <P variant="caption">
        <Trans>Puzzle rating</Trans>
      </P>
      <H2 size="title" numeral testId="chess-stats-elo">
        {formatPuzzleRating({
          rating: props.stats.currentRating,
          provisional: props.stats.provisional,
        })}
      </H2>
      <Show when={props.stats.ratingSeries.length > 1}>
        <StackVertical width="full" maxWidth="form">
          <Sparkline
            values={props.stats.ratingSeries}
            size="sm"
            testId="chess-stats-summary-sparkline"
          />
        </StackVertical>
      </Show>
      <Show when={props.stats.provisional}>
        <P variant="caption" tone="secondary" align="center">
          <Trans>
            The ? marks a provisional rating. It settles after a few more rated
            puzzles.
          </Trans>
        </P>
      </Show>
    </StackVertical>
  );
}

/** How the latest logged puzzle went, with the puzzle's own rating. */
function LatestPuzzle(props: { entry: PuzzleGameLogEntry }): JSX.Element {
  return (
    <Text
      variant="inherit"
      testId="chess-stats-latest"
      dataSet={{ puzzle: props.entry.puzzleId }}
    >
      <Switch fallback={<Trans>Abandoned</Trans>}>
        <Match when={props.entry.outcome === 'solved'}>
          <Trans>Solved</Trans>
        </Match>
        <Match when={props.entry.outcome === 'failed'}>
          <Trans>Failed</Trans>
        </Match>
      </Switch>{' '}
      {props.entry.puzzleRating}
    </Text>
  );
}

/**
 * Onward from the summary, each row with its current value: the trend
 * with how many puzzles were rated, the log with its latest puzzle (or
 * that nothing was played).
 */
function StatsRows(props: PuzzleStatsScreenViewProps): JSX.Element {
  const rated = (): number =>
    props.gameLog.filter((entry) => entry.rated).length;
  return (
    <MenuSection>
      <MenuRow
        title={<Trans>Rating trend</Trans>}
        value={
          <Text variant="inherit" testId="chess-stats-rated-count">
            <Trans>{rated()} rated</Trans>
          </Text>
        }
        onClick={() => props.onOpen({ screen: 'trend' })}
        dataSet={{ testid: 'chess-stats-open-trend' }}
      />
      <MenuRow
        title={<Trans>Game log</Trans>}
        // How many, as the row's value; the latest under the name, whole.
        value={<Trans>{props.gameLog.length} played</Trans>}
        caption={
          <Show
            when={props.gameLog[0]}
            keyed
            fallback={
              <Text variant="inherit" testId="chess-stats-log-empty">
                <Trans>Nothing played yet</Trans>
              </Text>
            }
          >
            {(latest) => (
              <Text variant="inherit">
                <Trans>Last:</Trans> <LatestPuzzle entry={latest} />
              </Text>
            )}
          </Show>
        }
        onClick={() => props.onOpen({ screen: 'log' })}
        dataSet={{ testid: 'chess-stats-open-log' }}
      />
    </MenuSection>
  );
}

/**
 * The `summary` place: the rating, played, solved and accuracy at one
 * glance, and the rows on to the trend and the log.
 */
export function PuzzleStatsSummaryView(
  props: PuzzleStatsScreenViewProps
): JSX.Element {
  return (
    <EmbeddedScreen
      screenId="chess-stats"
      nested={props.nested}
      title={titleOf(props, () => <Trans>Puzzle stats</Trans>)}
    >
      <Show when={props.stage === 'ready'} fallback={<LoadingState />}>
        <StackVertical gap="xl">
          <StatsRating {...props} />
          <PuzzleStatsCards stats={props.stats} />
          <StatsRows {...props} />
          {/* Nothing played yet: the way to the first puzzle, right here,
              not behind a row onto another empty screen. */}
          <Show
            when={props.gameLog.length === 0 && solveAction(props.onPlay)}
            keyed
          >
            {(action) => (
              <Button
                title={action.label}
                intent="primary"
                size="lg"
                fullWidth
                onClick={() => action.onClick()}
                dataSet={{ testid: 'chess-stats-solve' }}
              />
            )}
          </Show>
        </StackVertical>
      </Show>
    </EmbeddedScreen>
  );
}

/**
 * The `trend` place: the rating over time, drawn and in numbers (the rating
 * after each of the latest rated puzzles), or that nothing is rated yet.
 */
export function PuzzleStatsTrendView(
  props: PuzzleStatsScreenViewProps
): JSX.Element {
  const rated = (): boolean => props.gameLog.some((entry) => entry.rated);
  return (
    <EmbeddedScreen
      screenId="chess-stats-trend"
      dataSet={{ testid: 'chess-stats-trend' }}
      nested={props.nested}
      title={titleOf(props, () => <Trans>Rating trend</Trans>)}
    >
      <Show
        when={rated()}
        fallback={
          <EmptyState
            variant="compact"
            icon={ActivityIcon}
            title={<Trans>No rated puzzles yet.</Trans>}
            body={<Trans>Solve a puzzle and your rating starts moving.</Trans>}
            action={solveAction(props.onPlay)}
            dataSet={{ testid: 'chess-stats-trend-empty' }}
          />
        }
      >
        <StackVertical gap="xl">
          <TrendChart series={props.stats.ratingSeries} />
          <PuzzleRatingHistory entries={props.gameLog} />
        </StackVertical>
      </Show>
    </EmbeddedScreen>
  );
}

/**
 * The `log` place: every puzzle played, newest first; a row opens that
 * puzzle's review.
 */
export function PuzzleStatsLogView(
  props: PuzzleStatsScreenViewProps
): JSX.Element {
  return (
    <EmbeddedScreen
      screenId="chess-stats-log"
      dataSet={{ testid: 'chess-stats-log' }}
      nested={props.nested}
      title={titleOf(props, () => <Trans>Game log</Trans>)}
    >
      <PuzzleGameLog
        entries={props.gameLog}
        onSelectEntry={props.onSelectEntry}
        onPlay={props.onPlay}
      />
    </EmbeddedScreen>
  );
}
