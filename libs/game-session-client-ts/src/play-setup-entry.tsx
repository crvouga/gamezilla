import { GameSetupMode } from '@libs/spaces-client-ts/game-setup-mode';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';
import { FrameLobbyPage } from './game-frame-shell';
import type { FramePlaceProps } from './game-session-screen-view';

export function PlaySetupEntry(props: FramePlaceProps): JSX.Element {
  return (
    <FrameLobbyPage {...props} screenId={props.mode}>
      <GameSetupMode />
      <Show
        when={props.canCreate}
        fallback={
          <Notice>
            <Trans>Waiting for the host to start a game.</Trans>
          </Notice>
        }
      >
        <GameActionButton
          variant="solid"
          title={
            props.mode === 'vs-bot' ? (
              <Trans>Set up bot game</Trans>
            ) : (
              <Trans>Open table</Trans>
            )
          }
          operation={() =>
            props.onChoose({ operation: 'create', mode: props.mode })
          }
          dataSet={{ testid: 'game-session-create' }}
        />
      </Show>
    </FrameLobbyPage>
  );
}
