import { customGameCancelRefusal } from '@libs/chess-custom-game-shared/custom-game-refusal';
import { DenialSurface } from '@libs/permissions-client/denial-surface';
import { DefineBackButton } from '@libs/spaces-client/spaces-nav-context';
import { Trans } from '@lingui/solid/macro';
import { GameActionButton } from '@pkgs/ui-root-client/game-action-button';
import { GameHeader } from '@pkgs/ui-root-client/game-header';
import { GameLayout, GameScreen } from '@pkgs/ui-root-client/game-screen';
import { GameSection } from '@pkgs/ui-root-client/game-section';
import { type JSX, Match, Show, Switch } from 'solid-js';
import { CustomGameActive } from './custom-game-active';
import { CustomGameBoard } from './custom-game-board';
import { CustomGameConfiguration } from './custom-game-configuration';
import { CustomGameConfirm } from './custom-game-confirm';
import { CustomGameError } from './custom-game-error';
import { CustomGameSides } from './custom-game-side';
import { CustomGameStatus } from './custom-game-status';
import { CustomGameTest } from './custom-game-test';
import { useCustomGameReview } from './use-custom-game-review';
import type { CustomGameScreenModel } from './use-custom-game-screen';
import { useCustomGameScreen } from './use-custom-game-screen';

function CustomGameStarter(props: {
  model: CustomGameScreenModel;
}): JSX.Element {
  return (
    <GameSection
      title={<Trans>Make it your game</Trans>}
      description={
        <Trans>
          Choose who plays White and Black. Anyone in this space can watch.
        </Trans>
      }
    >
      <Show
        when={props.model.canCreate()}
        fallback={
          <p>
            <Trans>Waiting for the creator to create a game.</Trans>
          </p>
        }
      >
        <div class="box flex-row gap-2 flex-wrap">
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
        </div>
      </Show>
    </GameSection>
  );
}

function CustomGameLifecycle(props: {
  model: CustomGameScreenModel;
}): JSX.Element {
  return (
    <Switch
      fallback={
        <Show when={props.model.canCreate()}>
          <div class="box flex-row gap-2 flex-wrap">
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
          </div>
        </Show>
      }
    >
      <Match when={props.model.current()?.status === 'active'}>
        <CustomGameActive model={props.model} />
      </Match>
    </Switch>
  );
}

function CustomGameContent(props: {
  model: CustomGameScreenModel;
}): JSX.Element {
  const review = useCustomGameReview(props.model);
  return (
    <div
      class="box gap-4"
      data-component="CustomGameContent"
      data-testid="chess-custom-content"
    >
      <CustomGameStatus model={props.model} />
      <CustomGameError reason={props.model.error()} />
      <Show
        when={props.model.current() !== null}
        fallback={<CustomGameStarter model={props.model} />}
      >
        <CustomGameSides model={props.model} />
        <Show when={props.model.current()?.status === 'configuring'}>
          <CustomGameConfiguration model={props.model} />
        </Show>
        <GameLayout
          aside={
            <GameSection title={<Trans>Your game</Trans>}>
              <Show when={props.model.current()?.status !== 'configuring'}>
                <CustomGameLifecycle model={props.model} />
              </Show>
              <CustomGameExitActions model={props.model} />
            </GameSection>
          }
        >
          <CustomGameBoard model={props.model} review={review} />
        </GameLayout>
      </Show>
      <CustomGameTest model={props.model} review={review} />
    </div>
  );
}

function CustomGameExitActions(props: {
  model: CustomGameScreenModel;
}): JSX.Element {
  const unfinished = () =>
    props.model.current()?.status === 'configuring' ||
    props.model.current()?.status === 'active';
  return (
    <div class="box flex-row flex-wrap gap-2">
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
      <CustomGameConfirm
        model={props.model}
        operation="resign"
        available={
          props.model.current()?.status === 'active' &&
          props.model.mySide() !== null &&
          props.model.canPlay()
        }
      />
    </div>
  );
}

export function CustomGameScreen(): JSX.Element {
  const model = useCustomGameScreen();
  return (
    <>
      <DefineBackButton onPress={model.back} />
      <GameScreen
        screenId="chess-custom-game"
        breadcrumbs={[
          { name: <Trans>Chess</Trans>, onClick: model.back },
          { name: <Trans>Custom Game</Trans> },
        ]}
      >
        <GameHeader
          context={<Trans>Chess · Custom game</Trans>}
          title={<Trans>Your friends. Your rules.</Trans>}
          description={
            <Trans>
              Build a lineup, warm up against a bot, or play together.
            </Trans>
          }
        />
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
