import { DenialSurface } from '@libs/permissions-client/denial-surface';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { useSpaceRoomSessionId } from '@libs/spaces-client/space-room-context';
import { DefineBackButton } from '@libs/spaces-client/spaces-nav-context';
import { useSpaceDecision } from '@libs/spaces-client/use-space-decision';
import { Trans } from '@lingui/solid/macro';
import { useGamePresentation } from '@pkgs/turn-game-client/turn-games-context';
import { Button } from '@pkgs/ui-root-client/button';
import { EmptyState } from '@pkgs/ui-root-client/empty-state';
import { GameHistoryScreen } from '@pkgs/ui-root-client/game-history-screen';
import { GameReviewScreen } from '@pkgs/ui-root-client/game-review-screen';
import { GameActions } from '@pkgs/ui-root-client/game-section';
import { GameStat } from '@pkgs/ui-root-client/game-stat';
import { Grid } from '@pkgs/ui-root-client/grid';
import { LoadingState } from '@pkgs/ui-root-client/loading-state';
import { MainMenuItemRow } from '@pkgs/ui-root-client/main-menu-item-row';
import { MenuList } from '@pkgs/ui-root-client/menu-list';
import { P } from '@pkgs/ui-root-client/text';
import { createSignal, For, type JSX, Match, Show, Switch } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { GameHistoryParticipant } from './game-history-participant';
import { useGameRecordLabel } from './game-record-label';
import { type GameHistoryRecord, useGameRecords } from './use-game-records';

function RecordReview(props: {
  record: GameHistoryRecord;
  onBack: () => void;
}): JSX.Element {
  const recordLabel = useGameRecordLabel();
  const [ply, setPly] = createSignal(props.record.moves.length);
  const presentation = useGamePresentation();
  const position = () =>
    ply() === 0
      ? (props.record.moves[0]?.before ?? props.record.position)
      : props.record.moves[ply() - 1]!.after;
  return (
    <>
      <DefineBackButton onPress={props.onBack} />
      <GameReviewScreen
        screenId="game-history-review"
        title={<Trans>Game replay</Trans>}
        timeline={
          <P variant="caption" role="status">
            <Trans>
              Move {ply()} of {props.record.moves.length}.{' '}
              {recordLabel(props.record)}
            </Trans>
          </P>
        }
        actions={
          <GameActions>
            <Button
              title={<Trans>Previous move</Trans>}
              disabled={ply() === 0}
              onClick={() => setPly((n) => n - 1)}
            />
            <Button
              title={<Trans>Next move</Trans>}
              disabled={ply() === props.record.moves.length}
              onClick={() => setPly((n) => n + 1)}
            />
          </GameActions>
        }
      >
        <Dynamic
          component={presentation(position()).Board}
          position={position()}
          orientation="white"
          interactive={false}
          sound={false}
          syncKey={0}
          onAction={() => {}}
          testId="game-history-board"
        />
      </GameReviewScreen>
    </>
  );
}
/** The finished games, or why there are none to show yet. */
function GameHistoryRecords(props: {
  records: readonly GameHistoryRecord[];
  loading: boolean;
  onSelect: (record: GameHistoryRecord) => void;
}): JSX.Element {
  const recordLabel = useGameRecordLabel();
  return (
    <Switch
      fallback={
        <MenuList role="group" dataSet={{ testid: 'game-history-records' }}>
          <For each={props.records}>
            {(record) => (
              <MainMenuItemRow
                item={{
                  key: record.id,
                  title: (
                    <>
                      <GameHistoryParticipant
                        id={record.first}
                        bot={record.firstBot}
                      />{' '}
                      /{' '}
                      <GameHistoryParticipant
                        id={record.second}
                        bot={record.secondBot}
                      />
                    </>
                  ),
                  caption: recordLabel(record),
                  dataSet: { testid: 'game-history-record' },
                  onClick: () => props.onSelect(record),
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

function AllowedGameHistory(props: {
  gameId: string;
  onBack: () => void;
}): JSX.Element {
  const model = useGameRecords(() => props.gameId);
  const [selected, select] = createSignal<GameHistoryRecord | null>(null);
  return (
    <Show
      when={selected()}
      keyed
      fallback={
        <>
          <DefineBackButton onPress={props.onBack} />
          <GameHistoryScreen
            screenId="game-history"
            title={<Trans>History and stats</Trans>}
            subtitle={
              <Trans>
                Finished custom games in this space and your recent matched
                games.
              </Trans>
            }
            statistics={
              <Grid
                columns={3}
                gap="md"
                testId="game-history-statistics"
                dataSet={{
                  wins: String(model.statistics().wins),
                  losses: String(model.statistics().losses),
                  draws: String(model.statistics().draws),
                }}
              >
                <GameStat
                  label={<Trans>Wins</Trans>}
                  value={model.statistics().wins}
                  detail={null}
                />
                <GameStat
                  label={<Trans>Losses</Trans>}
                  value={model.statistics().losses}
                  detail={null}
                />
                <GameStat
                  label={<Trans>Draws</Trans>}
                  value={model.statistics().draws}
                  detail={null}
                />
              </Grid>
            }
          >
            <GameHistoryRecords
              records={model.records()}
              loading={model.isLoading()}
              onSelect={select}
            />
          </GameHistoryScreen>
        </>
      }
    >
      {(record) => <RecordReview record={record} onBack={() => select(null)} />}
    </Show>
  );
}

export function GameHistory(props: {
  gameId: string;
  onBack: () => void;
}): JSX.Element {
  const space = useSpaceRoomSessionId();
  const decision = useSpaceDecision(
    () => space() ?? '',
    PERMISSION.gameCustomWatch
  );
  return (
    <Show
      when={decision().allowed}
      fallback={
        <DenialSurface decision={decision()} testId="game-history-denial" />
      }
    >
      <AllowedGameHistory {...props} />
    </Show>
  );
}
