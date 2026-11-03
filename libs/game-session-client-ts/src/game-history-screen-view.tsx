import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans } from '@lingui/solid/macro';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { GameHistoryScreen } from '@pkgs/ui-root-client-ts/game-history-screen';
import { GameStat } from '@pkgs/ui-root-client-ts/game-stat';
import { Grid } from '@pkgs/ui-root-client-ts/grid';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { MainMenuItemRow } from '@pkgs/ui-root-client-ts/main-menu-item-row';
import { MenuList } from '@pkgs/ui-root-client-ts/menu-list';
import { For, type JSX, Match, Show, Switch } from 'solid-js';
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

/** One finished game in the list. */
export type GameHistoryRow = {
  readonly id: string;
  readonly players: readonly GameHistoryPlayer[];
  /** How it ended, in words ("Red circle wins by four in a row."). */
  readonly label: string;
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
  readonly records: readonly GameHistoryRow[];
  readonly people?: FramePeople | undefined;
  readonly onSelect: (id: string) => void;
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

/** The finished games, or why there are none to show yet. */
function HistoryRecords(props: GameHistoryScreenViewProps): JSX.Element {
  return (
    <Switch
      fallback={
        <MenuList dataSet={{ testid: 'game-history-records' }}>
          <For each={props.records}>
            {(record) => (
              <MainMenuItemRow
                item={{
                  key: record.id,
                  title: (
                    <For each={record.players}>
                      {(player, index) => (
                        <>
                          <Show when={index() > 0}> / </Show>
                          <HistoryPlayer
                            player={player}
                            people={props.people}
                          />
                        </>
                      )}
                    </For>
                  ),
                  caption: record.label,
                  dataSet: { testid: 'game-history-record' },
                  onClick: () => props.onSelect(record.id),
                }}
              />
            )}
          </For>
        </MenuList>
      }
    >
      <Match when={props.records.length === 0 && props.loading}>
        <LoadingState
          variant="compact"
          caption={<Trans>Loading games…</Trans>}
          dataSet={{ testid: 'game-history-loading' }}
        />
      </Match>
      <Match when={props.records.length === 0}>
        <EmptyState
          variant="compact"
          title={<Trans>No completed games yet.</Trans>}
          body={<Trans>Finished games will appear here.</Trans>}
          dataSet={{ testid: 'game-history-empty' }}
        />
      </Match>
    </Switch>
  );
}

/**
 * A game's History and stats, presentational: wins, losses and draws, then
 * the finished custom games of the space and the person's matched games,
 * with their loading, empty and denied states. `GameHistory` reads them.
 */
export function GameHistoryScreenView(
  props: GameHistoryScreenViewProps
): JSX.Element {
  return (
    <Show
      when={props.denial}
      fallback={
        <GameHistoryScreen
          screenId="game-history"
          title={<Trans>History and stats</Trans>}
          subtitle={
            <Trans>
              Finished custom games in this space and your recent matched games.
            </Trans>
          }
          statistics={
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
                value={props.statistics.wins}
                detail={null}
              />
              <GameStat
                label={<Trans>Losses</Trans>}
                value={props.statistics.losses}
                detail={null}
              />
              <GameStat
                label={<Trans>Draws</Trans>}
                value={props.statistics.draws}
                detail={null}
              />
            </Grid>
          }
        >
          <HistoryRecords {...props} />
        </GameHistoryScreen>
      }
    >
      {(denial) => <DenialSurfaceView denial={denial()} />}
    </Show>
  );
}
