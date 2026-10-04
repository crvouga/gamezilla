import { DenialSurface } from '@libs/permissions-client/denial-surface';
import { useDecision } from '@libs/permissions-client/use-can';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { Trans } from '@lingui/solid/macro';
import { useSyncEngine } from '@pkgs/sync-engine-client/sync-engine-context';
import { useLocalSearchParams } from '@pkgs/ui-client/app-router';
import { ErrorState } from '@pkgs/ui-client/error-state';
import { ScreenBase } from '@pkgs/ui-client/screen-base';
import { type JSX, Show } from 'solid-js';
import { MultiplayerBoard } from './multiplayer-board';
import { MultiplayerControls } from './multiplayer-controls';
import { useMultiplayerControls } from './use-multiplayer-controls';
import { useMultiplayerData } from './use-multiplayer-data';

function MultiplayerContent(props: {
  readonly data: ReturnType<typeof useMultiplayerData>;
  readonly controls: ReturnType<typeof useMultiplayerControls>;
  readonly requestedGame: string | undefined;
}): JSX.Element {
  const decision = useDecision(PERMISSION.matchmakingView);
  const sync = useSyncEngine();
  return (
    <div class="box gap-4" data-component="MultiplayerContent">
      <Show
        when={decision().allowed}
        fallback={
          <DenialSurface
            decision={decision()}
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
            props.requestedGame !== undefined &&
            props.data.game() === null &&
            !props.data.loading()
          }
        >
          <p role="status" data-testid="multiplayer-unavailable">
            <Trans>No multiplayer game is available to you.</Trans>
          </p>
        </Show>
        <MultiplayerControls
          data={props.data}
          controls={props.controls}
          requestedGame={props.requestedGame}
        />
      </Show>
    </div>
  );
}

export default function MultiplayerScreen(): JSX.Element {
  const params = useLocalSearchParams<{ gameId?: string }>();
  const data = useMultiplayerData(() => params().gameId);
  const controls = useMultiplayerControls(data);
  return (
    <ScreenBase
      screenId="chess-multiplayer"
      scroll
      breadcrumbs={[
        { name: <Trans>Home</Trans>, href: '/' },
        { name: <Trans>Multiplayer chess</Trans> },
      ]}
      content={() => (
        <MultiplayerContent
          data={data}
          controls={controls}
          requestedGame={params().gameId}
        />
      )}
    />
  );
}
