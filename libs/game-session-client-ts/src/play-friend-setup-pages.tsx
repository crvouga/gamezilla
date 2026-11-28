import type { JSX } from '@solidjs/web';
import { Match, Switch } from 'solid-js';
import {
  FrameClockPlace,
  FrameOptionsPlace,
  FramePrivateSetupPlace,
} from './game-frame-agreed-view';
import type { FrameSetup, FrameSetupSeat } from './game-frame-view-types';
import type { FramePlaceProps } from './game-session-screen-view';
import { FrameInvitePlace, FrameSeatPlace } from './play-friend-seat-view';
import { PlayFriendSetupPlace } from './play-friend-setup-view';

type Props = FramePlaceProps;

function placeSeat(props: Props): FrameSetupSeat | null {
  const place = props.place;
  if (place.screen !== 'seat' && place.screen !== 'invite') return null;
  return props.setup?.seats.find((seat) => seat.side === place.side) ?? null;
}

/** A friend's table: a person's seat, an invitation, options, the clock. */
export function FriendSetup(
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
