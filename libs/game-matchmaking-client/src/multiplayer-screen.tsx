import { DenialSurface } from '@libs/permissions-client/denial-surface';
import { useDecision } from '@libs/permissions-client/use-can';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { DefineBackButton } from '@libs/spaces-client/spaces-nav-context';
import { Trans } from '@lingui/solid/macro';
import { useSyncEngine } from '@pkgs/sync-engine-client/sync-engine-context';
import { GameScreen } from '@pkgs/ui-root-client/game-screen';
import { GameSessionLayout } from '@pkgs/ui-root-client/game-session-layout';
import { Notice } from '@pkgs/ui-root-client/notice';
import { type JSX, Show } from 'solid-js';
import { MultiplayerBoard } from './multiplayer-board';
import { MultiplayerControls } from './multiplayer-controls';
import { MultiplayerMoves } from './multiplayer-moves';
import { MultiplayerNotices } from './multiplayer-notices';
import { MultiplayerRatings } from './multiplayer-ratings';
import { useDeadlineSettle } from './use-deadline-settle';
import { useMultiplayerControls } from './use-multiplayer-controls';
import { useMultiplayerData } from './use-multiplayer-data';
import type { OwnBoard } from './use-own-board';
import { useOwnBoard } from './use-own-board';

type ScreenProps = {
  readonly data: ReturnType<typeof useMultiplayerData>;
  readonly controls: ReturnType<typeof useMultiplayerControls>;
  readonly view: OwnBoard;
};

/** The board when there is a game, then what the person can do next. */
function MultiplayerStage(props: ScreenProps): JSX.Element {
  const sync = useSyncEngine();
  return (
    <>
      <Show when={props.data.game()}>
        {(game) => (
          <MultiplayerBoard
            game={game()}
            myId={props.data.myId()}
            connected={sync.status().online}
            moving={props.controls.moving()}
            syncKey={props.controls.boardSync()}
            view={props.view}
            onMove={props.controls.play}
          />
        )}
      </Show>
      <Show
        when={
          props.data.game() === null &&
          props.data.search() === null &&
          !props.data.loading()
        }
      >
        <Notice dataSet={{ testid: 'multiplayer-unavailable' }}>
          <span role="status">
            <Trans>No multiplayer game is available to you.</Trans>
          </span>
        </Notice>
      </Show>
      <MultiplayerControls data={props.data} controls={props.controls} />
    </>
  );
}

function MultiplayerContent(props: ScreenProps): JSX.Element {
  const decision = useDecision(PERMISSION.gameMultiplayerWatch, () => ({
    spacePresence:
      props.data.hostId() === props.data.myId()
        ? 'host'
        : props.data.hostId()
          ? 'guest'
          : null,
  }));
  const searchDecision = useDecision(PERMISSION.matchmakingView);
  const access = () =>
    props.data.game() !== null || props.data.hostId() !== props.data.myId()
      ? decision()
      : searchDecision();
  const sync = useSyncEngine();
  useDeadlineSettle({
    game: props.data.game,
    online: () => sync.status().online,
    settle: props.controls.settle,
  });
  return (
    <Show
      when={access().allowed}
      fallback={
        <DenialSurface decision={access()} testId="multiplayer-access-denial" />
      }
    >
      <MultiplayerNotices
        controls={props.controls}
        online={sync.status().online}
      />
      <GameSessionLayout
        aside={
          <>
            <Show when={props.data.game()}>
              {(game) => <MultiplayerMoves game={game()} view={props.view} />}
            </Show>
            <MultiplayerRatings
              gameId={props.data.gameId()}
              ratings={props.data.ratings()}
            />
          </>
        }
      >
        <MultiplayerStage
          data={props.data}
          controls={props.controls}
          view={props.view}
        />
      </GameSessionLayout>
    </Show>
  );
}

export default function MultiplayerScreen(props: {
  gameId: string;
  onBack: () => void;
  title: string;
}): JSX.Element {
  const data = useMultiplayerData(() => props.gameId);
  const controls = useMultiplayerControls(data);
  const view = useOwnBoard(data.game);
  return (
    <>
      <DefineBackButton onPress={props.onBack} />
      <GameScreen screenId="multiplayer" title={props.title}>
        <MultiplayerContent data={data} controls={controls} view={view} />
      </GameScreen>
    </>
  );
}
