import { DenialSurface } from '@libs/permissions-client-ts/denial-surface';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { DefineBackButton } from '@libs/spaces-client-ts/spaces-nav-context';
import { Trans } from '@lingui/solid/macro';
import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Show } from 'solid-js';
import { MultiplayerBoard } from './multiplayer-board';
import { MultiplayerControls } from './multiplayer-controls';
import { MultiplayerMoves } from './multiplayer-moves';
import { MultiplayerNotices } from './multiplayer-notices';
import { MultiplayerPrivateSetupPanel } from './multiplayer-private-setup';
import { MultiplayerRatings } from './multiplayer-ratings';
import { useDeadlineSettle } from './use-deadline-settle';
import { useMultiplayerControls } from './use-multiplayer-controls';
import { useMultiplayerData } from './use-multiplayer-data';
import { useMultiplayerPrivateSetup } from './use-multiplayer-private-setup';
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
  const setup = useMultiplayerPrivateSetup(props.data.game, props.data.myId);
  return (
    <>
      <Show when={props.data.game()}>
        {(game) => (
          <MultiplayerPrivateSetupPanel
            game={game()}
            setup={setup}
            onChoose={props.controls.chooseSetup}
          />
        )}
      </Show>
      <Show when={props.data.game()}>
        {(game) => (
          <MultiplayerBoard
            ownSetup={setup.own()}
            game={game()}
            room={props.data.room()}
            myId={props.data.myId()}
            connected={sync.status().online}
            moving={props.controls.moving()}
            syncKey={props.controls.boardSync()}
            view={props.view}
            onMove={props.controls.play}
          />
        )}
      </Show>
      <Show when={props.data.game() === null && props.data.search() === null}>
        <Show
          when={!props.data.loading()}
          fallback={
            <LoadingState
              variant="compact"
              caption={<Trans>Loading the game…</Trans>}
              dataSet={{ testid: 'multiplayer-loading' }}
            />
          }
        >
          <Notice dataSet={{ testid: 'multiplayer-unavailable' }}>
            <Text variant="inherit" role="status">
              <Trans>No multiplayer game is available to you.</Trans>
            </Text>
          </Notice>
        </Show>
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
      <GameSessionLayout
        notices={
          <MultiplayerNotices
            controls={props.controls}
            online={sync.status().online}
          />
        }
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
