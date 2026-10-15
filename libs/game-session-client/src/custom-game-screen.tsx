import { customGameCancelRefusal } from '@libs/game-session-shared/custom-game-refusal';
import { DenialSurface } from '@libs/permissions-client/denial-surface';
import { DefineBackButton } from '@libs/spaces-client/spaces-nav-context';
import { Trans } from '@lingui/solid/macro';
import { GameActionButton } from '@pkgs/ui-root-client/game-action-button';
import { GameScreen } from '@pkgs/ui-root-client/game-screen';
import { GameActions } from '@pkgs/ui-root-client/game-section';
import { GameSessionLayout } from '@pkgs/ui-root-client/game-session-layout';
import { GameSetupPanel } from '@pkgs/ui-root-client/game-setup-panel';
import { type JSX, Show } from 'solid-js';
import {
  CustomGameActiveNotices,
  CustomGameDrawActions,
} from './custom-game-active';
import { CustomGameBoard, CustomGameRecord } from './custom-game-board';
import { CustomGameConfiguration } from './custom-game-configuration';
import { CustomGameConfirm } from './custom-game-confirm';
import { CustomGameError } from './custom-game-error';
import { CustomGameSeats } from './custom-game-side';
import {
  CustomGameConnectionNotice,
  CustomGameStatus,
} from './custom-game-status';
import { CustomGameTest } from './custom-game-test';
import { useCustomGameReview } from './use-custom-game-review';
import type { CustomGameScreenModel } from './use-custom-game-screen';
import { useCustomGameScreen } from './use-custom-game-screen';

type ModelProps = { model: CustomGameScreenModel };

function CustomGameStarter(props: ModelProps): JSX.Element {
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
          <p class="text textCaption">
            <Trans>Waiting for the creator to create a game.</Trans>
          </p>
        }
      >
        <GameActions>
          <GameActionButton
            title={<Trans>Create game</Trans>}
            dataSet={{ testid: 'chess-custom-create' }}
            variant="solid"
            operation={() => props.model.choose({ operation: 'create' })}
          />
          <GameActionButton
            title={<Trans>Play a bot</Trans>}
            dataSet={{ testid: 'chess-custom-play-bot' }}
            operation={props.model.playBot}
          />
        </GameActions>
      </Show>
    </GameSetupPanel>
  );
}

/** After a game is over the creator may start the next one. */
function CustomGameNextActions(props: ModelProps): JSX.Element {
  const over = (): boolean =>
    props.model.current()?.status === 'completed' ||
    props.model.current()?.status === 'cancelled';
  return (
    <Show when={over() && props.model.canCreate()}>
      <GameActionButton
        title={<Trans>New game</Trans>}
        dataSet={{ testid: 'chess-custom-new' }}
        variant="solid"
        operation={() => props.model.choose({ operation: 'create' })}
      />
      <GameActionButton
        title={<Trans>Rematch</Trans>}
        dataSet={{ testid: 'chess-custom-rematch' }}
        operation={() => props.model.choose({ operation: 'rematch' })}
      />
    </Show>
  );
}

function CustomGameExitActions(props: ModelProps): JSX.Element {
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

function CustomGameContent(props: ModelProps): JSX.Element {
  const review = useCustomGameReview(props.model);
  return (
    <>
      <GameSessionLayout
        dataSet={{
          component: 'CustomGameContent',
          testid: 'chess-custom-content',
        }}
        notices={
          <>
            <CustomGameConnectionNotice model={props.model} />
            <CustomGameError reason={props.model.error()} />
          </>
        }
        setup={
          <Show
            when={props.model.current() !== null}
            fallback={
              <>
                <CustomGameStatus model={props.model} />
                <CustomGameStarter model={props.model} />
              </>
            }
          >
            <Show when={props.model.current()?.status === 'configuring'}>
              <CustomGameSeats model={props.model} />
              <CustomGameConfiguration model={props.model} />
            </Show>
          </Show>
        }
        aside={
          props.model.current() === null ? undefined : (
            <CustomGameRecord model={props.model} review={review} />
          )
        }
        status={
          <Show when={props.model.current() !== null}>
            <CustomGameStatus model={props.model} />
            <Show when={props.model.current()?.status === 'active'}>
              <CustomGameActiveNotices model={props.model} />
            </Show>
          </Show>
        }
        actions={
          <Show when={props.model.current() !== null}>
            <Show when={props.model.current()?.status === 'active'}>
              <CustomGameDrawActions model={props.model} />
            </Show>
            <CustomGameNextActions model={props.model} />
            <CustomGameExitActions model={props.model} />
          </Show>
        }
      >
        <Show when={props.model.current() !== null}>
          <CustomGameBoard model={props.model} review={review} />
        </Show>
      </GameSessionLayout>
      <CustomGameTest model={props.model} review={review} />
    </>
  );
}

export function CustomGameScreen(props: {
  gameId: string;
  onBack: () => void;
  title?: string;
  onHistory?: () => void;
}): JSX.Element {
  const model = useCustomGameScreen(
    props.onBack,
    () => props.gameId,
    props.onHistory
  );
  return (
    <>
      <DefineBackButton onPress={model.back} />
      <GameScreen
        screenId="chess-custom-game"
        title={props.title ?? <Trans>Custom game</Trans>}
      >
        <Show
          when={model.watchDecision().allowed}
          fallback={
            <DenialSurface
              decision={model.watchDecision()}
              testId="chess-custom-denial"
            />
          }
        >
          <CustomGameContent model={model} />
        </Show>
      </GameScreen>
    </>
  );
}
