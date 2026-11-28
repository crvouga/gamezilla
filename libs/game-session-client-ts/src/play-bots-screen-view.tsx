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
import { createFrameConfirm, FrameConfirmDialog } from './game-frame-shell';
import { withStableTable } from './game-frame-stable-table';
import type { FrameSetup, FrameSetupSeat } from './game-frame-view-types';
import type {
  FramePlaceProps,
  GameSessionScreenViewProps,
} from './game-session-screen-view';
import { BotDifficultyPlace } from './play-bots-seat-view';
import { PlayBotsSetupPlace } from './play-bots-setup-view';
import { PlayBotsStagePlace } from './play-bots-stage-view';

import { PlaySetupEntry } from './play-setup-entry';

type Props = Omit<FramePlaceProps, 'mode'> & { readonly mode: 'vs-bot' };

function botSeat(props: Props): FrameSetupSeat | null {
  const place = props.place;
  if (place.screen !== 'seat') return null;
  return props.setup?.seats.find((seat) => seat.side === place.side) ?? null;
}

/**
 * A bot game's setup. Each other seat is a bot, and the only thing to
 * change is how strong it is.
 */
function BotSetup(props: Props & { readonly setup: FrameSetup }): JSX.Element {
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

function BotPlaces(
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
        {(setup) => <BotSetup {...props} setup={setup()} />}
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
        <PlayBotsStagePlace {...props} />
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
 * Play Bots. Every seat but the player's is a bot. These screens never
 * offer a person, an invitation, or an open seat.
 */
export function PlayBotsScreenView(
  props: Omit<GameSessionScreenViewProps, 'mode'>
): JSX.Element {
  const confirm = createFrameConfirm();
  const stable = withStableTable(props);
  return (
    <>
      <Show
        when={props.denial}
        fallback={
          <BotPlaces
            {...stable}
            mode="vs-bot"
            onConfirm={confirm.ask}
            confirming={confirm.asked() !== null}
          />
        }
      >
        {(denial) => (
          <EmbeddedScreen screenId="play-bots-denied" title={props.title}>
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
