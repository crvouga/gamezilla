import { t } from '@lingui/core/macro';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameActionBar } from '@pkgs/ui-root-client-ts/game-action-bar';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import {
  FixedGameSession,
  type GameSessionAllMoves,
} from '@pkgs/ui-root-client-ts/game-session-layout';
import { EllipsisIcon } from '@pkgs/ui-root-client-ts/icons';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';
import { FrameMovesCard } from './game-frame-moves-view';
import { FrameStage } from './game-frame-stage';
import {
  FrameErrorView,
  FrameFactsView,
  FrameStageConditionLine,
  FrameStatusView,
  frameStageHeldUp,
} from './game-frame-status-view';
import type { FramePlaceProps } from './game-session-screen-view';

type Props = FramePlaceProps;

function realTime(props: Props): boolean {
  return props.record !== null && !props.record.turns;
}

function lineSpokenOnly(props: Props): boolean {
  const status = props.status;
  if (status === null || !status.plainTurn || status.sending) return false;
  if (status.tone !== 'neutral') return false;
  return realTime(props);
}

/** The line beside the commands: the player's turn, or the bot's. */
function PlayLine(props: Props): JSX.Element {
  const status = (): Props['status'] => {
    const line = props.status;
    if (line === null || !line.plainTurn) return line;
    if (line.emphasis === 'yours')
      return { ...line, description: t`Your turn.` };
    return { ...line, description: t`Bot to move.` };
  };
  return (
    <FrameStatusView
      status={status()}
      arena={realTime(props)}
      quiet
      spokenOnly={lineSpokenOnly(props)}
    />
  );
}

function commandsOffered(props: Props): boolean {
  return (
    props.play.canResign ||
    props.play.canCancel ||
    props.record?.history === true
  );
}

function PlayActions(props: Props): JSX.Element {
  return (
    <Show
      when={!(props.stopped && props.onReopen !== undefined)}
      fallback={
        <GameActionBar items={[]} aria-label={t`Game actions`} width="content">
          <Button
            title={<Trans>Reopen game</Trans>}
            variant="solid"
            onClick={() => props.onReopen?.()}
            dataSet={{ testid: 'play-bots-reopen' }}
          />
        </GameActionBar>
      }
    >
      <GameActionBar
        aria-label={t`Game actions`}
        items={props.play.sessionActions}
        width="content"
      >
        <Show when={props.play.canClaimWin}>
          <GameActionButton
            title={<Trans>Claim the win</Trans>}
            variant="solid"
            dataSet={{ testid: 'play-bots-claim-win' }}
            operation={() => props.onChoose({ operation: 'claimWin' })}
          />
        </Show>
        <Show when={props.play.canResign && !props.menuMatchCommands}>
          <Button
            title={<Trans>Resign</Trans>}
            variant="outline"
            intent="danger"
            onClick={() => props.onConfirm('resign')}
            dataSet={{ testid: 'play-bots-resign-now' }}
          />
        </Show>
        <Show when={props.play.heldResign}>
          <Button
            title={<Trans>Resign</Trans>}
            variant="outline"
            intent="neutral"
            disabled
            dataSet={{ testid: 'play-bots-resign-held' }}
          />
        </Show>
        <Show when={commandsOffered(props)}>
          <Button
            title={<Trans>Game menu</Trans>}
            variant="outline"
            intent="neutral"
            icon={EllipsisIcon}
            onClick={() => props.onOpen({ screen: 'commands' })}
            dataSet={{ testid: 'game-session-commands' }}
          />
        </Show>
      </GameActionBar>
    </Show>
  );
}

function allMovesOf(props: Props): GameSessionAllMoves | undefined {
  const record = props.record;
  if (record === null || !record.turns || record.moves.length === 0)
    return undefined;
  return {
    label: <Trans>All moves</Trans>,
    testId: 'play-bots-all-moves',
    onPress: () => {
      props.onSeek(record.displayedPly);
      props.onOpen({ screen: 'moves' });
    },
  };
}

/**
 * Play Bots' board. The opponent is a bot, so there is no draw to offer
 * and nobody else watches the table.
 */
export function PlayBotsStagePlace(props: Props): JSX.Element {
  return (
    <GameScreen
      screenId="vs-bot-play"
      title={props.title}
      compactInset={props.table.compactInset}
      facts={<FrameFactsView status={props.status} />}
    >
      <FixedGameSession
        dataSet={{
          component: 'PlayBotsContent',
          testid: 'game-session-content',
          phase: props.phase,
          place: props.place.screen,
        }}
        notices={<FrameErrorView text={props.error} />}
        status={
          <>
            <Show when={props.connection === 'offline-local'}>
              <P variant="caption" tone="default" role="status">
                <Trans>
                  You're offline. Your game against the bot can continue.
                </Trans>
              </P>
            </Show>
            <Show
              when={!frameStageHeldUp(props)}
              fallback={<FrameStageConditionLine {...props} />}
            >
              <PlayLine {...props} />
            </Show>
          </>
        }
        actions={<PlayActions {...props} />}
        history={<FrameMovesCard {...props} />}
        allMoves={allMovesOf(props)}
      >
        {(information) => <FrameStage {...props} information={information} />}
      </FixedGameSession>
    </GameScreen>
  );
}
