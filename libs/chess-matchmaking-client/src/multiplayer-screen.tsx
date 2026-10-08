import {
  CHESS_SCREEN,
  SetChessMainMenuScreen,
} from '@libs/chess-root-shared/chess-main-menu';
import { DenialSurface } from '@libs/permissions-client/denial-surface';
import { useDecision } from '@libs/permissions-client/use-can';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { DefineBackButton } from '@libs/spaces-client/spaces-nav-context';
import { useSpaceRoomDispatch } from '@libs/spaces-client/use-space-room-selector';
import { Trans } from '@lingui/solid/macro';
import { useSyncEngine } from '@pkgs/sync-engine-client/sync-engine-context';
import { GameHeader } from '@pkgs/ui-root-client/game-header';
import { GameLayout, GameScreen } from '@pkgs/ui-root-client/game-screen';
import { type JSX, Show } from 'solid-js';
import { MultiplayerBoard } from './multiplayer-board';
import { MultiplayerControls } from './multiplayer-controls';
import { MultiplayerNotices } from './multiplayer-notices';
import { MultiplayerRatings } from './multiplayer-ratings';
import { useDeadlineSettle } from './use-deadline-settle';
import { useMultiplayerControls } from './use-multiplayer-controls';
import { useMultiplayerData } from './use-multiplayer-data';

function MultiplayerContent(props: {
  readonly data: ReturnType<typeof useMultiplayerData>;
  readonly controls: ReturnType<typeof useMultiplayerControls>;
}): JSX.Element {
  const decision = useDecision(PERMISSION.chessMultiplayerWatch, () => ({
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
    <div class="box gap-4" data-component="MultiplayerContent">
      <Show
        when={access().allowed}
        fallback={
          <DenialSurface
            decision={access()}
            testId="multiplayer-access-denial"
          />
        }
      >
        <MultiplayerNotices
          controls={props.controls}
          online={sync.status().online}
        />
        <GameLayout
          aside={
            <>
              <Show when={props.data.game()}>
                <MultiplayerControls
                  data={props.data}
                  controls={props.controls}
                />
              </Show>
              <MultiplayerRatings ratings={props.data.ratings()} />
            </>
          }
        >
          <Show
            when={props.data.game()}
            fallback={
              <MultiplayerControls
                data={props.data}
                controls={props.controls}
              />
            }
          >
            {(game) => (
              <MultiplayerBoard
                game={game()}
                myId={props.data.myId()}
                connected={sync.status().online}
                moving={props.controls.moving()}
                syncKey={props.controls.boardSync()}
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
            <p role="status" data-testid="multiplayer-unavailable">
              <Trans>No multiplayer game is available to you.</Trans>
            </p>
          </Show>
        </GameLayout>
      </Show>
    </div>
  );
}

export default function MultiplayerScreen(): JSX.Element {
  const data = useMultiplayerData();
  const controls = useMultiplayerControls(data);
  const dispatch = useSpaceRoomDispatch();
  return (
    <>
      <DefineBackButton
        onPress={() =>
          dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.root }))
        }
      />
      <GameScreen
        screenId="chess-multiplayer"
        breadcrumbs={[
          {
            name: <Trans>Chess</Trans>,
            onClick: () =>
              dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.root })),
          },
          { name: <Trans>Matchmaking</Trans> },
        ]}
      >
        <GameHeader
          eyebrow={<Trans>Chess · Matchmaking</Trans>}
          title={<Trans>Your next great game</Trans>}
          description={
            <Trans>A new rival. A fresh board. Pick your pace and play.</Trans>
          }
        />
        <MultiplayerContent data={data} controls={controls} />
      </GameScreen>
    </>
  );
}
