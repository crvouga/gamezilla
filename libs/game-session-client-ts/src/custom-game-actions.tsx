import { customGameCancelRefusal } from '@libs/game-session-shared-ts/custom-game-refusal';
import { Trans } from '@lingui/solid/macro';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameActions } from '@pkgs/ui-root-client-ts/game-section';
import { GameSetupPanel } from '@pkgs/ui-root-client-ts/game-setup-panel';
import { P } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Show } from 'solid-js';
import { CustomGameConfirm } from './custom-game-confirm';
import type { CustomGameScreenModel } from './use-custom-game-screen';

type ModelProps = { model: CustomGameScreenModel };

export function CustomGameStarter(props: ModelProps): JSX.Element {
  return (
    <GameSetupPanel
      title={<Trans>New game</Trans>}
      description={
        <Trans>
          Choose who plays each side. Anyone in this space can watch.
        </Trans>
      }
    >
      <Show
        when={props.model.canCreate()}
        fallback={
          <P variant="caption" tone="secondary">
            <Trans>Waiting for the creator to create a game.</Trans>
          </P>
        }
      >
        <GameActions>
          <GameActionButton
            title={<Trans>Create game</Trans>}
            dataSet={{ testid: 'custom-game-create' }}
            variant="solid"
            operation={() => props.model.choose({ operation: 'create' })}
          />
          <GameActionButton
            title={
              <Show
                when={props.model.playerCount() > 2}
                fallback={<Trans>Play a bot</Trans>}
              >
                <Trans>Play against bots</Trans>
              </Show>
            }
            dataSet={{ testid: 'custom-game-play-bot' }}
            operation={props.model.playBot}
          />
        </GameActions>
      </Show>
    </GameSetupPanel>
  );
}

export function CustomGameExitActions(props: ModelProps): JSX.Element {
  const unfinished = () =>
    props.model.current()?.status === 'configuring' ||
    props.model.current()?.status === 'active';
  return (
    <>
      <CustomGameConfirm
        model={props.model}
        operation="resign"
        available={
          props.model.current()?.status === 'active' &&
          props.model.mySide() !== null &&
          props.model.canPlay()
        }
      />
      <CustomGameConfirm
        model={props.model}
        operation="cancel"
        available={
          unfinished() &&
          props.model.canCancel() &&
          customGameCancelRefusal(
            props.model.current()!,
            props.model.myId()
          ) === ''
        }
      />
    </>
  );
}
