import type { JSX } from '@solidjs/web';
import { Match, Switch } from 'solid-js';
import {
  FrameClockPlace,
  FrameOptionsPlace,
  FramePrivateSetupPlace,
} from './game-frame-agreed-view';
import type { FrameSetup, FrameSetupSeat } from './game-frame-view-types';
import type { FramePlaceProps } from './game-session-screen-view';
import { BotDifficultyPlace } from './play-bots-seat-view';
import { PlayBotsSetupPlace } from './play-bots-setup-view';

type Props = FramePlaceProps;

function botSeat(props: Props): FrameSetupSeat | null {
  const place = props.place;
  if (place.screen !== 'seat') return null;
  return props.setup?.seats.find((seat) => seat.side === place.side) ?? null;
}

/**
 * A bot game's setup. Each other seat is a bot, and the only thing to
 * change is how strong it is.
 */
export function BotSetup(
  props: Props & { readonly setup: FrameSetup }
): JSX.Element {
  const screen = () => props.place.screen;
  return (
    <Switch fallback={<PlayBotsSetupPlace {...props} />}>
      <Match when={screen() === 'seat' ? botSeat(props) : null}>
        {(seat) => <BotDifficultyPlace {...props} seat={seat()} />}
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
