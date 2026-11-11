import { formatPuzzleRating } from '@libs/game-puzzle-shared-ts/rating';
import { Trans } from '@lingui/solid/macro';
import { EmbeddedScreen } from '@pkgs/ui-root-client-ts/embedded-screen';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { H2 } from '@pkgs/ui-root-client-ts/heading';
import { ActivityIcon } from '@pkgs/ui-root-client-ts/icons';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { Sparkline } from '@pkgs/ui-root-client-ts/sparkline';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Show } from 'solid-js';
import { PuzzleGameLog } from './puzzle-game-log';
import { PuzzleRatingHistory } from './puzzle-rating-history';
import { PuzzleStatsCards } from './puzzle-stats-cards';
import type { PuzzleStatsScreenViewProps } from './puzzle-stats-screen-view';

/** A screen's own title, unless the host's bar already names it. */
function titleOf(
  props: PuzzleStatsScreenViewProps,
  title: () => JSX.Element
): JSX.Element | undefined {
  return props.titled === false ? undefined : title();
}

/** The headline: the player's puzzle rating. */
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
    </StackVertical>
  );
}

/** Onward from the summary: the trend and the log, each with its size. */
function StatsRows(props: PuzzleStatsScreenViewProps): JSX.Element {
  const rated = (): number =>
    props.gameLog.filter((entry) => entry.rated).length;
  return (
    <MenuSection>
      <MenuRow
        title={<Trans>Rating trend</Trans>}
        value={<Trans>{rated()} rated</Trans>}
        onClick={() => props.onOpen({ screen: 'trend' })}
        dataSet={{ testid: 'chess-stats-open-trend' }}
      />
      <MenuRow
        title={<Trans>Game log</Trans>}
        value={<Trans>{props.gameLog.length} played</Trans>}
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
      title={titleOf(props, () => (
        <Trans>Puzzle stats</Trans>
      ))}
    >
      <Show when={props.stage === 'ready'} fallback={<LoadingState />}>
        <StackVertical gap="xl">
          <StatsRating {...props} />
          <PuzzleStatsCards stats={props.stats} />
          <StatsRows {...props} />
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
      nested={props.nested}
      title={titleOf(props, () => (
        <Trans>Rating trend</Trans>
      ))}
    >
      <Show
        when={rated()}
        fallback={
          <EmptyState
            variant="compact"
            icon={ActivityIcon}
            title={<Trans>No rated puzzles yet.</Trans>}
            body={<Trans>Solve a puzzle and your rating starts moving.</Trans>}
            dataSet={{ testid: 'chess-stats-trend-empty' }}
          />
        }
      >
        <StackVertical gap="xl">
          <StackVertical width="full" maxWidth="form" self="center">
            <Sparkline
              values={props.stats.ratingSeries}
              testId="chess-stats-sparkline"
            />
          </StackVertical>
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
      nested={props.nested}
      title={titleOf(props, () => (
        <Trans>Game log</Trans>
      ))}
    >
      <PuzzleGameLog
        entries={props.gameLog}
        onSelectEntry={props.onSelectEntry}
      />
    </EmbeddedScreen>
  );
}
