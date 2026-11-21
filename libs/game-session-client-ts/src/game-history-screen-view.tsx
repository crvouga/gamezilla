import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { t } from '@lingui/core/macro';
import { Plural, Trans } from '@lingui/solid/macro';
import { Badge, type BadgeIntent } from '@pkgs/ui-root-client-ts/badge';
import { EmbeddedScreen } from '@pkgs/ui-root-client-ts/embedded-screen';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { GameStat } from '@pkgs/ui-root-client-ts/game-stat';
import { Grid } from '@pkgs/ui-root-client-ts/grid';
import { ChevronRightIcon, HistoryIcon } from '@pkgs/ui-root-client-ts/icons';
import { MainMenuItemRow } from '@pkgs/ui-root-client-ts/main-menu-item-row';
import { MenuList } from '@pkgs/ui-root-client-ts/menu-list';
import { useRelativeTimeLabel } from '@pkgs/ui-root-client-ts/relative-time';
import { SegmentedControl } from '@pkgs/ui-root-client-ts/segmented-control';
import { Skeleton } from '@pkgs/ui-root-client-ts/skeleton';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import { P } from '@pkgs/ui-root-client-ts/text';
import {
  createMemo,
  createSignal,
  For,
  type JSX,
  Match,
  Show,
  Switch,
} from 'solid-js';
import { FramePersonName } from './game-frame-people';
import type { FramePeople } from './game-frame-view-types';

/** One player of a finished game: a person, a bot, a guest on this device, or nobody. */
export type GameHistoryPlayer = {
  /** The person's id; `''` for anyone else. */
  readonly person: string;
  readonly plainName: string;
  readonly bot: boolean;
  readonly local: boolean;
};

/** The viewer's result in a finished game they played. */
export type GameHistoryOutcome = 'won' | 'lost' | 'draw' | 'cancelled';

/** One finished game in the list. */
export type GameHistoryRow = {
  readonly id: string;
  /** Who the viewer played: everyone else in the game, or everyone when they only watched. */
  readonly players: readonly GameHistoryPlayer[];
  /** The viewer's own result; `null` when they did not play in it. */
  readonly outcome: GameHistoryOutcome | null;
  /**
   * How it ended, in words: without who won when `outcome` says it ("By
   * four in a row"), else in full ("Red circle wins by four in a row.").
   */
  readonly label: string;
  /** Who won, for a game the viewer only watched; empty for a draw or when they played. */
  readonly winners?: readonly GameHistoryPlayer[] | undefined;
  /** When it ended, as an ISO instant; `null` when unknown. */
  readonly endedAt: string | null;
};

export type GameHistoryScreenViewProps = {
  /** Set when the person may not see this space's games. */
  readonly denial?: DenialView | undefined;
  /** Still reading the finished games. */
  readonly loading: boolean;
  readonly statistics: {
    readonly wins: number;
    readonly losses: number;
    readonly draws: number;
  };
  /** Newest first. */
  readonly records: readonly GameHistoryRow[];
  readonly people?: FramePeople | undefined;
  readonly onSelect: (id: string) => void;
  /** Where a new game starts, for the empty history. */
  readonly onPlay?: (() => void) | undefined;
};

type Filter = 'all' | GameHistoryOutcome;

/** Between a caption's facts: held to both, so a line never starts or ends with it. */
const SEPARATOR = '\u00a0·\u00a0';

/** A list this long gets a filter by result. */
const FILTER_FROM = 6;

const OUTCOME_INTENT: Readonly<Record<GameHistoryOutcome, BadgeIntent>> = {
  won: 'success',
  lost: 'destructive',
  draw: 'neutral',
  cancelled: 'neutral',
};

/** An unfilled place in a cancelled configuration is not a bot participant. */
function HistoryPlayer(props: {
  readonly player: GameHistoryPlayer;
  readonly people?: FramePeople | undefined;
}): JSX.Element {
  return (
    <Show
      when={props.player.person !== ''}
      fallback={
        <Show
          when={props.player.local}
          fallback={
            <Show
              when={props.player.bot}
              fallback={<Trans>No participant</Trans>}
            >
              <Trans>Bot</Trans>
            </Show>
          }
        >
          <Trans>Player on this device</Trans>
        </Show>
      }
    >
      <FramePersonName
        person={props.player.person}
        plainName={props.player.plainName}
        people={props.people}
      />
    </Show>
  );
}

/** Players by name, joined by "vs" (rivals) or "&" (one side). */
function PlayerNames(props: {
  readonly players: readonly GameHistoryPlayer[];
  readonly join: 'vs' | 'and';
  readonly people?: FramePeople | undefined;
}): JSX.Element {
  return (
    <For each={props.players}>
      {(player, index) => (
        <>
          <Show when={index() > 0}>
            {' '}
            <Show when={props.join === 'and'} fallback={<Trans>vs</Trans>}>
              &amp;
            </Show>{' '}
          </Show>
          <HistoryPlayer player={player} people={props.people} />
        </>
      )}
    </For>
  );
}

/** The players a row names: "vs jordan" to someone who played, "avery vs jordan" otherwise. */
export function HistoryPlayers(props: {
  readonly players: readonly GameHistoryPlayer[];
  readonly played: boolean;
  readonly people?: FramePeople | undefined;
}): JSX.Element {
  return (
    <Show
      when={props.players.length > 0}
      fallback={<Trans>Nobody else joined</Trans>}
    >
      <Show
        when={props.played}
        fallback={
          <PlayerNames
            players={props.players}
            join="vs"
            people={props.people}
          />
        }
      >
        <Trans>vs</Trans>{' '}
        <PlayerNames players={props.players} join="and" people={props.people} />
      </Show>
    </Show>
  );
}

/** The viewer's result in words, coloured to match: Won, Lost, Draw, Cancelled. */
export function OutcomeBadge(props: {
  readonly outcome: GameHistoryOutcome;
}): JSX.Element {
  return (
    <Badge
      size="md"
      intent={OUTCOME_INTENT[props.outcome]}
      dataSet={{ testid: 'game-history-outcome', outcome: props.outcome }}
      label={
        <Switch>
          <Match when={props.outcome === 'won'}>
            <Trans>Won</Trans>
          </Match>
          <Match when={props.outcome === 'lost'}>
            <Trans>Lost</Trans>
          </Match>
          <Match when={props.outcome === 'draw'}>
            <Trans>Draw</Trans>
          </Match>
          <Match when={props.outcome === 'cancelled'}>
            <Trans>Cancelled</Trans>
          </Match>
        </Switch>
      }
    />
  );
}

/** "By four in a row · 2d ago": one short line, the moves left to the replay. */
function RecordCaption(props: {
  readonly record: GameHistoryRow;
  readonly people?: FramePeople | undefined;
}): JSX.Element {
  const ago = useRelativeTimeLabel(() => props.record.endedAt ?? '');
  const winners = () => props.record.winners ?? [];
  return (
    <>
      {/* A separator is held to the facts on both sides and "12h ago" stays
          whole, so a wrapped caption never starts or ends with "·". */}
      <Show when={winners().length > 0}>
        <PlayerNames players={winners()} join="and" people={props.people} />{' '}
        <Trans>won</Trans>
      </Show>
      <Show when={winners().length > 0 && props.record.label !== ''}>
        {SEPARATOR}
      </Show>
      {props.record.label}
      <Show when={props.record.endedAt !== null}>
        {SEPARATOR}
        {ago().replaceAll(' ', '\u00a0')}
      </Show>
    </>
  );
}

function RecordRow(props: {
  readonly record: GameHistoryRow;
  readonly people?: FramePeople | undefined;
  readonly onSelect: (id: string) => void;
}): JSX.Element {
  return (
    <MainMenuItemRow
      item={{
        key: props.record.id,
        title: (
          <HistoryPlayers
            players={props.record.players}
            played={props.record.outcome !== null}
            people={props.people}
          />
        ),
        caption: <RecordCaption record={props.record} people={props.people} />,
        trailing: (
          <StackHorizontal align="center" gap="sm">
            <Show
              when={props.record.outcome}
              fallback={
                <Badge
                  size="md"
                  intent="info"
                  dataSet={{
                    testid: 'game-history-outcome',
                    outcome: 'watched',
                  }}
                  label={<Trans>Watched</Trans>}
                />
              }
            >
              {(outcome) => <OutcomeBadge outcome={outcome()} />}
            </Show>
            <ChevronRightIcon size={20} color="icon" />
          </StackHorizontal>
        ),
        dataSet: { testid: 'game-history-record' },
        onClick: () => props.onSelect(props.record.id),
      }}
    />
  );
}

/** All, Won, Lost, Draws: shown once the list is long enough to search. */
function ResultFilter(props: {
  readonly filter: Filter;
  readonly onFilter: (filter: Filter) => void;
}): JSX.Element {
  return (
    <SegmentedControl<Filter>
      aria-label={t`Show games by result`}
      segments={[
        { key: 'all', label: t`All` },
        { key: 'won', label: t`Won` },
        { key: 'lost', label: t`Lost` },
        { key: 'draw', label: t`Draws` },
      ]}
      selected={props.filter}
      onSelect={props.onFilter}
      dataSet={{ testid: 'game-history-filter' }}
    />
  );
}

/** The finished games, or why there are none to show yet. */
function HistoryRecords(
  props: GameHistoryScreenViewProps & { readonly filter: Filter }
): JSX.Element {
  const shown = createMemo(() =>
    props.filter === 'all'
      ? props.records
      : props.records.filter((record) => record.outcome === props.filter)
  );
  return (
    <Switch
      fallback={
        <MenuList dataSet={{ testid: 'game-history-records' }}>
          <For each={shown()}>
            {(record) => (
              <RecordRow
                record={record}
                people={props.people}
                onSelect={props.onSelect}
              />
            )}
          </For>
        </MenuList>
      }
    >
      <Match when={props.records.length === 0 && props.loading}>
        <StackVertical gap="sm" testId="game-history-loading">
          <P variant="caption" tone="secondary" role="status">
            <Trans>Loading games…</Trans>
          </P>
          <Skeleton shape="rect" width="100%" height={64} />
          <Skeleton shape="rect" width="100%" height={64} />
          <Skeleton shape="rect" width="100%" height={64} />
        </StackVertical>
      </Match>
      <Match when={props.records.length === 0}>
        <EmptyState
          variant="compact"
          icon={HistoryIcon}
          title={<Trans>No finished games yet</Trans>}
          body={
            <Trans>
              Every game you finish here is kept, with each move to replay.
            </Trans>
          }
          action={
            props.onPlay === undefined
              ? undefined
              : { label: <Trans>Play a game</Trans>, onClick: props.onPlay }
          }
          dataSet={{ testid: 'game-history-empty' }}
        />
      </Match>
      <Match when={shown().length === 0}>
        <EmptyState
          variant="compact"
          title={<Trans>No games with this result</Trans>}
          body={<Trans>Choose All to see every finished game.</Trans>}
          dataSet={{ testid: 'game-history-filter-empty' }}
        />
      </Match>
    </Switch>
  );
}

/** Wins, losses and draws; a dash for each until the games are read. */
function HistoryStatistics(props: GameHistoryScreenViewProps): JSX.Element {
  const value = (count: number): JSX.Element => (
    <Show when={!props.loading || props.records.length > 0} fallback="–">
      {count}
    </Show>
  );
  return (
    <Surface tone="surface" radius="card" border padding="md" gap="xs">
      <P variant="caption" tone="secondary">
        <Trans>All games</Trans>
      </P>
      <Grid
        columns={3}
        gap="md"
        testId="game-history-statistics"
        dataSet={{
          wins: String(props.statistics.wins),
          losses: String(props.statistics.losses),
          draws: String(props.statistics.draws),
        }}
      >
        <GameStat
          label={<Trans>Wins</Trans>}
          value={value(props.statistics.wins)}
          detail={null}
        />
        <GameStat
          label={<Trans>Losses</Trans>}
          value={value(props.statistics.losses)}
          detail={null}
        />
        <GameStat
          label={<Trans>Draws</Trans>}
          value={value(props.statistics.draws)}
          detail={null}
        />
      </Grid>
    </Surface>
  );
}

/**
 * A game's History and stats, presentational, as a page in the space's
 * stage (the space's own row carries Back): wins, losses and draws, then
 * the finished custom games of the space and the person's matched games,
 * newest first, each led by the person's own result, with a filter by
 * result once the list is long, and its loading, empty and denied states.
 * `GameHistory` reads them.
 */
export function GameHistoryScreenView(
  props: GameHistoryScreenViewProps
): JSX.Element {
  const [filter, setFilter] = createSignal<Filter>('all');
  return (
    <Show
      when={props.denial}
      fallback={
        <EmbeddedScreen
          screenId="game-history"
          title={<Trans>History and stats</Trans>}
          subtitle={<Trans>Finished games, newest first.</Trans>}
        >
          <HistoryStatistics {...props} />
          <Show when={props.records.length >= FILTER_FROM}>
            <StackVertical gap="xs">
              <ResultFilter filter={filter()} onFilter={setFilter} />
              <Show when={filter() !== 'all'}>
                <P
                  variant="caption"
                  tone="secondary"
                  role="status"
                  testId="game-history-filter-count"
                >
                  <Plural
                    value={
                      props.records.filter(
                        (record) => record.outcome === filter()
                      ).length
                    }
                    one="# game"
                    other="# games"
                  />{' '}
                  <Trans>· the totals above are for all games</Trans>
                </P>
              </Show>
            </StackVertical>
          </Show>
          <HistoryRecords {...props} filter={filter()} />
        </EmbeddedScreen>
      }
    >
      {(denial) => <DenialSurfaceView denial={denial()} />}
    </Show>
  );
}
