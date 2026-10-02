import { DenialSurface } from '@libs/permissions/public/denial-surface';
import { DefineBackButton } from '@libs/spaces/public/nav/spaces-nav-context';
import { Trans } from '@lingui/solid/macro';
import { ScreenBase } from '@pkgs/ui';
import { Match, Show, Switch, type JSX } from 'solid-js';
import { CustomGameAction } from './custom-game-action';
import { CustomGameActive } from './custom-game-active';
import { CustomGameBoard } from './custom-game-board';
import { CustomGameConfiguration } from './custom-game-configuration';
import { CustomGameConfirm } from './custom-game-confirm';
import { CustomGameError } from './custom-game-error';
import { CustomGameSides } from './custom-game-side';
import { CustomGameStatus } from './custom-game-status';
import { CustomGameTest } from './custom-game-test';
import { useCustomGameReview } from './use-custom-game-review';
import {
  useCustomGameScreen,
  type CustomGameScreenModel,
} from './use-custom-game-screen';

function CustomGameStarter(props: {
  model: CustomGameScreenModel;
}): JSX.Element {
  return (
    <div class="box gap-4">
      <p class="textBody">
        <Trans>
          Choose who plays White and Black. Anyone in this space can watch.
        </Trans>
      </p>
      <Show
        when={props.model.canCreate()}
        fallback={
          <p>
            <Trans>Waiting for the creator to create a game.</Trans>
          </p>
        }
      >
        <div class="box row gap-2 flex-wrap">
          <CustomGameAction
            title={<Trans>Create game</Trans>}
            testId="chess-custom-create"
            operation={() => props.model.choose({ operation: 'create' })}
          />
          <CustomGameAction
            title={<Trans>Play a bot</Trans>}
            testId="chess-custom-play-bot"
            operation={props.model.playBot}
          />
        </div>
      </Show>
    </div>
  );
}

function CustomGameLifecycle(props: {
  model: CustomGameScreenModel;
}): JSX.Element {
  return (
    <Switch
      fallback={
        <Show when={props.model.canCreate()}>
          <div class="box row gap-2 flex-wrap">
            <CustomGameAction
              title={<Trans>New game</Trans>}
              testId="chess-custom-new"
              operation={() => props.model.choose({ operation: 'create' })}
            />
            <CustomGameAction
              title={<Trans>Rematch</Trans>}
              testId="chess-custom-rematch"
              operation={() => props.model.choose({ operation: 'rematch' })}
            />
          </div>
        </Show>
      }
    >
      <Match when={props.model.current()?.status === 'configuring'}>
        <CustomGameConfiguration model={props.model} />
      </Match>
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
  const unfinished = (): boolean =>
    props.model.current()?.status === 'configuring' ||
    props.model.current()?.status === 'active';
  return (
    <div class="box gap-4 p-4" data-component="CustomGameContent">
      <CustomGameStatus model={props.model} />
      <CustomGameError reason={props.model.error()} />
      <Show
        when={props.model.current() !== null}
        fallback={<CustomGameStarter model={props.model} />}
      >
        <CustomGameSides model={props.model} />
        <CustomGameLifecycle model={props.model} />
        <Show when={unfinished() && props.model.canCancel()}>
          <CustomGameConfirm model={props.model} operation="cancel" />
        </Show>
        <CustomGameBoard model={props.model} review={review} />
      </Show>
      <CustomGameTest model={props.model} review={review} />
    </div>
  );
}

export function CustomGameScreen(): JSX.Element {
  const model = useCustomGameScreen();
  return (
    <>
      <DefineBackButton onPress={model.back} />
      <ScreenBase
        screenId="chess-custom-game"
        breadcrumbs={[
          { name: <Trans>Chess</Trans>, onClick: model.back },
          { name: <Trans>Custom Game</Trans> },
        ]}
        scroll
        content={() => (
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
        )}
      />
    </>
  );
}
