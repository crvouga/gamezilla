import { DenialSurface } from '@libs/permissions-client-ts/denial-surface';
import { DefineBackButton } from '@libs/spaces-client-ts/spaces-nav-context';
import { Trans } from '@lingui/solid/macro';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
import { type JSX, Show } from 'solid-js';
import {
  CustomGameExitActions,
  CustomGameNextActions,
  CustomGameStarter,
} from './custom-game-actions';
import {
  CustomGameActiveNotices,
  CustomGameDrawActions,
} from './custom-game-active';
import { CustomGameBoard, CustomGameRecord } from './custom-game-board';
import { CustomGameConfiguration } from './custom-game-configuration';
import { CustomGameError } from './custom-game-error';
import { CustomGamePrivateSetup } from './custom-game-private-setup';
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

function CustomGameContent(props: ModelProps): JSX.Element {
  const review = useCustomGameReview(props.model);
  return (
    <>
      <GameSessionLayout
        dataSet={{
          component: 'CustomGameContent',
          testid: 'custom-game-content',
        }}
        notices={
          <>
            <CustomGameConnectionNotice model={props.model} />
            <CustomGameError
              reason={props.model.error()}
              position={props.model.current()?.fen}
            />
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
              <CustomGamePrivateSetup model={props.model} />
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
        screenId="custom-game"
        title={props.title ?? <Trans>Custom game</Trans>}
      >
        <Show
          when={model.watchDecision().allowed}
          fallback={
            <DenialSurface
              decision={model.watchDecision()}
              testId="custom-game-denial"
            />
          }
        >
          <CustomGameContent model={model} />
        </Show>
      </GameScreen>
    </>
  );
}
