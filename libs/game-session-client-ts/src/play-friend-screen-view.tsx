import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { EmbeddedScreen } from '@pkgs/ui-root-client-ts/embedded-screen';
import type { JSX } from '@solidjs/web';
import { Match, Show, Switch } from 'solid-js';
import {
  FrameClockPlace,
  FrameOptionsPlace,
  FramePrivateSetupPlace,
} from './game-frame-agreed-view';
import { FrameCommandsPlace } from './game-frame-commands-view';
import { FrameMovesPlace } from './game-frame-moves-view';
import { FrameResultPlace } from './game-frame-result-place-view';
import { FrameInvitePlace, FrameSeatPlace } from './game-frame-seat-view';
import { createFrameConfirm, FrameConfirmDialog } from './game-frame-shell';
import { withStableTable } from './game-frame-stable-table';
import type { FrameSetup, FrameSetupSeat } from './game-frame-view-types';
import type {
  FramePlaceProps,
  GameSessionScreenViewProps,
} from './game-session-screen-view';
import { PlayFriendSetupPlace } from './play-friend-setup-view';
import { PlayFriendStagePlace } from './play-friend-stage-view';

import { PlaySetupEntry } from './play-setup-entry';

type Props = FramePlaceProps;

function placeSeat(props: Props): FrameSetupSeat | null {
  const place = props.place;
  if (place.screen !== 'seat' && place.screen !== 'invite') return null;
  return props.setup?.seats.find((seat) => seat.side === place.side) ?? null;
}

/** A friend's table: a person's seat, an invitation, options, the clock. */
function FriendSetup(
  props: Props & { readonly setup: FrameSetup }
): JSX.Element {
  const screen = () => props.place.screen;
  return (
    <Switch fallback={<PlayFriendSetupPlace {...props} />}>
      <Match when={screen() === 'seat' ? placeSeat(props) : null}>
        {(seat) => <FrameSeatPlace {...props} seat={seat()} />}
      </Match>
      <Match when={screen() === 'invite' ? placeSeat(props) : null}>
        {(seat) => <FrameInvitePlace {...props} seat={seat()} />}
      </Match>
      <Match when={screen() === 'options' ? props.setup.options : null}>
        {(options) => <FrameOptionsPlace {...props} options={options()} />}
      </Match>
      <Match when={screen() === 'clock' ? props.setup.options?.clock : null}>
        {(clock) => <FrameClockPlace {...props} clock={clock()} />}
      </Match>
      <Match
        when={screen() === 'private-setup' ? props.setup.privateSetup : null}
      >
        {(own) => <FramePrivateSetupPlace {...props} own={own()} />}
      </Match>
    </Switch>
  );
}

function FriendPlaces(
  props: Props & { readonly confirming: boolean }
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
        {(setup) => <FriendSetup {...props} setup={setup()} />}
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
        <PlayFriendStagePlace {...props} />
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

/**
 * Play Friend. People in the space take seats and answer invitations.
 * A bot is not a choice on any of these screens.
 */
export function PlayFriendScreenView(
  props: GameSessionScreenViewProps
): JSX.Element {
  const confirm = createFrameConfirm();
  const stable = withStableTable(props);
  return (
    <>
      <Show
        when={props.denial}
        fallback={
          <FriendPlaces
            {...stable}
            mode="vs-human"
            onConfirm={confirm.ask}
            confirming={confirm.asked() !== null}
          />
        }
      >
        {(denial) => (
          <EmbeddedScreen screenId="play-friend-denied" title={props.title}>
            <DenialSurfaceView denial={denial()} />
          </EmbeddedScreen>
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
