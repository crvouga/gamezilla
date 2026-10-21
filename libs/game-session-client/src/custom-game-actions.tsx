import { customGameCancelRefusal } from '@libs/game-session-shared/custom-game-refusal';
import { Trans } from '@lingui/solid/macro';
import { GameActionButton } from '@pkgs/ui-root-client/game-action-button';
import { GameActions } from '@pkgs/ui-root-client/game-section';
import { GameSetupPanel } from '@pkgs/ui-root-client/game-setup-panel';
import { P } from '@pkgs/ui-root-client/text';
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
            title={<Trans>Play a bot</Trans>}
            dataSet={{ testid: 'custom-game-play-bot' }}
            operation={props.model.playBot}
          />
        </GameActions>
      </Show>
    </GameSetupPanel>
  );
}

/** After a game is over the creator may start the next one. */
export function CustomGameNextActions(props: ModelProps): JSX.Element {
  const over = (): boolean =>
    props.model.current()?.status === 'completed' ||
    props.model.current()?.status === 'cancelled';
  return (
    <Show when={over() && props.model.canCreate()}>
      <GameActionButton
        title={<Trans>New game</Trans>}
        dataSet={{ testid: 'custom-game-new' }}
        variant="solid"
        operation={() => props.model.choose({ operation: 'create' })}
      />
      <GameActionButton
        title={<Trans>Rematch</Trans>}
        dataSet={{ testid: 'custom-game-rematch' }}
        operation={() => props.model.choose({ operation: 'rematch' })}
      />
    </Show>
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
