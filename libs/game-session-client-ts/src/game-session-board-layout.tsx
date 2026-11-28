import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import {
  FixedGameSession,
  type GameSessionAllMoves,
} from '@pkgs/ui-root-client-ts/game-session-layout';
import { GameWatcherCount } from '@pkgs/ui-root-client-ts/game-watching';
import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';
import { FrameMovesCard } from './game-frame-moves-view';
import { FrameStage } from './game-frame-stage';
import {
  FrameErrorView,
  FrameFactsView,
  frameWatchersLabel,
} from './game-frame-status-view';
import type { FramePlaceProps } from './game-session-screen-view';

/** The title-row facts and exact watcher count. */
export function FrameFacts(
  props: Pick<FramePlaceProps, 'status' | 'watchers'>
): JSX.Element {
  return (
    <>
      <FrameFactsView status={props.status} />
      <Show when={props.watchers > 0}>
        <GameWatcherCount
          value={props.watchers}
          label={frameWatchersLabel(props.watchers)}
          dataSet={{ testid: 'game-session-watchers' }}
        />
      </Show>
    </>
  );
}

function allMovesOf(props: FramePlaceProps): GameSessionAllMoves | undefined {
  const record = props.record;
  if (record === null || !record.turns || record.moves.length === 0)
    return undefined;
  return {
    label: <Trans>All moves</Trans>,
    testId:
      props.mode === 'vs-human'
        ? 'game-session-all-moves'
        : 'play-bots-all-moves',
    onPress: () => {
      props.onSeek(record.displayedPly);
      props.onOpen({ screen: 'moves' });
    },
  };
}

export function GameSessionBoardLayout(
  props: FramePlaceProps & {
    readonly facts: JSX.Element;
    readonly statusLine: JSX.Element;
    readonly actions: JSX.Element;
  }
): JSX.Element {
  return (
    <GameScreen
      screenId={props.mode + '-play'}
      title={props.title}
      compactInset={props.table.compactInset}
      facts={props.facts}
    >
      <FixedGameSession
        dataSet={{
          component:
            props.mode === 'vs-human'
              ? 'GameSessionContent'
              : 'PlayBotsContent',
          testid: 'game-session-content',
          phase: props.phase,
          place: props.place.screen,
        }}
        notices={<FrameErrorView text={props.error} />}
        status={props.statusLine}
        actions={props.actions}
        history={<FrameMovesCard {...props} />}
        allMoves={allMovesOf(props)}
      >
        {(information) => <FrameStage {...props} information={information} />}
      </FixedGameSession>
    </GameScreen>
  );
}
