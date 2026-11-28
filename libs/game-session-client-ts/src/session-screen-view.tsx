import {
  DenialSurfaceView,
  type DenialView,
} from '@libs/permissions-client-ts/denial-surface-view';
import { EmbeddedScreen } from '@pkgs/ui-root-client-ts/embedded-screen';
import type { JSX } from '@solidjs/web';
import { Match, Show, Switch } from 'solid-js';
import { FrameCommandsPlace } from './game-frame-commands-view';
import { FrameMovesPlace } from './game-frame-moves-view';
import { FrameResultPlace } from './game-frame-result-place-view';
import { createFrameConfirm, FrameConfirmDialog } from './game-frame-shell';
import { withStableTable } from './game-frame-stable-table';
import type { FrameSetup } from './game-frame-view-types';
import type {
  FramePlaceProps,
  GameSessionScreenViewProps,
} from './game-session-screen-view';
import { PlaySetupEntry } from './play-setup-entry';

export function SessionDenial(props: {
  mode: FramePlaceProps['mode'];
  title: JSX.Element;
  denial: DenialView;
}): JSX.Element {
  return (
    <EmbeddedScreen
      screenId={
        props.mode === 'vs-bot' ? 'play-bots-denied' : 'play-friend-denied'
      }
      title={props.title}
    >
      <DenialSurfaceView denial={props.denial} />
    </EmbeddedScreen>
  );
}

type SessionPages = {
  readonly mode: FramePlaceProps['mode'];
  readonly Setup: (
    props: FramePlaceProps & { readonly setup: FrameSetup }
  ) => JSX.Element;
  readonly Stage: (props: FramePlaceProps) => JSX.Element;
};

function SessionPlaces(
  props: FramePlaceProps & SessionPages & { readonly confirming: boolean }
): JSX.Element {
  const screen = () => props.place.screen;
  const over = (): boolean =>
    props.phase === 'completed' || props.phase === 'cancelled';
  return (
    <Switch>
      <Match when={props.phase === 'none' || (over() && screen() === 'home')}>
        <PlaySetupEntry {...props} />
      </Match>
      <Match when={props.phase === 'configuring' ? props.setup : null}>
        {(setup) => <props.Setup {...props} setup={setup()} />}
      </Match>
      <Match
        when={
          screen() === 'moves' && (props.phase === 'active' || over())
            ? props.record
            : null
        }
      >
        {(record) => <FrameMovesPlace {...props} record={record()} />}
      </Match>
      <Match when={props.phase === 'active'}>
        <props.Stage {...props} />
        <Show when={screen() === 'commands'}>
          <FrameCommandsPlace {...props} />
        </Show>
      </Match>
      <Match when={over() && screen() !== 'home'}>
        <FrameResultPlace {...props} confirming={props.confirming} />
      </Match>
    </Switch>
  );
}

export function SessionScreenView(
  props: GameSessionScreenViewProps & SessionPages
): JSX.Element {
  const confirm = createFrameConfirm();
  const stable = withStableTable(props);
  return (
    <>
      <Show
        when={props.denial}
        fallback={
          <SessionPlaces
            {...stable}
            onConfirm={confirm.ask}
            confirming={confirm.asked() !== null}
          />
        }
      >
        {(denial) => (
          <SessionDenial
            mode={props.mode}
            title={props.title}
            denial={denial()}
          />
        )}
      </Show>
      <FrameConfirmDialog
        confirm={confirm}
        onChoose={props.onChoose}
        beforeGame={props.phase === 'configuring'}
      />
    </>
  );
}
