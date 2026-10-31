import { DenialSurface } from '@libs/permissions-client-ts/denial-surface';
import { DefineBackButton } from '@libs/spaces-client-ts/spaces-nav-context';
import { Trans } from '@lingui/solid/macro';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
import { type JSX, Show } from 'solid-js';
import { CustomGameStarter } from './custom-game-actions';
import { CustomGameActiveNotices } from './custom-game-active';
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
import {
  FrameActions,
  FrameHeader,
  FrameWatching,
  useFrameBoard,
} from './game-frame-play';
import { GameFrameResult } from './game-frame-result';
import { useCustomGameReview } from './use-custom-game-review';
import type { CustomGameScreenModel } from './use-custom-game-screen';
import { useCustomGameScreen } from './use-custom-game-screen';

type ModelProps = { model: CustomGameScreenModel };

/**
 * Under the board: the line about a game being set up (once it is played
 * the line sits between the board and the person's own seat), what a
 * player is told during play, and the result once the game is over.
 */
function CustomGameStatusRow(props: ModelProps): JSX.Element {
  return (
    <Show when={props.model.current() !== null}>
      <Show when={props.model.current()?.status === 'configuring'}>
        <CustomGameStatus model={props.model} />
      </Show>
      <Show when={props.model.current()?.status === 'active'}>
        <CustomGameActiveNotices model={props.model} />
      </Show>
      <Show when={props.model.current()?.status === 'completed'}>
        <GameFrameResult model={props.model} />
      </Show>
    </Show>
  );
}

function CustomGameContent(props: ModelProps): JSX.Element {
  const review = useCustomGameReview(props.model);
  const board = useFrameBoard(props.model, review);
  return (
    <>
      <GameSessionLayout
        dataSet={{
          component: 'CustomGameContent',
          testid: 'custom-game-content',
        }}
        header={<FrameHeader model={props.model} />}
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
        status={<CustomGameStatusRow model={props.model} />}
        actions={
          <FrameActions model={props.model} board={board} review={review} />
        }
        footer={<FrameWatching model={props.model} />}
      >
        <Show when={props.model.current() !== null}>
          <CustomGameBoard model={props.model} review={review} board={board} />
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
