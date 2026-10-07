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
import { ErrorState } from '@pkgs/ui-root-client/error-state';
import { ScreenBase } from '@pkgs/ui-root-client/screen-base';
import { type JSX, Show } from 'solid-js';
import { MultiplayerBoard } from './multiplayer-board';
import { MultiplayerControls } from './multiplayer-controls';
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
        <Show when={props.controls.denial()}>
          {(denied) => (
            <DenialSurface
              decision={denied()}
              testId="multiplayer-command-denial"
            />
          )}
        </Show>
        <Show when={props.controls.error()}>
          {(error) => (
            <ErrorState
              variant="compact"
              title={<Trans>Multiplayer command refused</Trans>}
              body={error()}
              dataSet={{ testid: 'multiplayer-error' }}
            />
          )}
        </Show>
        <Show when={!sync.status().online}>
          <p role="status" data-testid="multiplayer-offline">
            <Trans>
              Multiplayer commands need a connection. Your accepted game stays
              here.
            </Trans>
          </p>
        </Show>
        <Show when={props.data.game()}>
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
            !props.data.loading() &&
            props.data.hostId() !== props.data.myId()
          }
        >
          <p role="status" data-testid="multiplayer-unavailable">
            <Trans>No multiplayer game is available to you.</Trans>
          </p>
        </Show>
        <MultiplayerControls data={props.data} controls={props.controls} />
        <MultiplayerRatings ratings={props.data.ratings()} />
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
      <ScreenBase
        screenId="chess-multiplayer"
        scroll
        breadcrumbs={[]}
        content={() => <MultiplayerContent data={data} controls={controls} />}
      />
    </>
  );
}
