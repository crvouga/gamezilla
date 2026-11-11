import { Trans } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { For, type JSX, Match, Show, Switch } from 'solid-js';
import type { FramePlaySeat } from './game-frame-view-types';

/**
 * The seat's public facts as tags: a stand-in bot playing it, whether it has
 * made its secret choice (never what), and the game's own facts.
 */
export function PlaySeatTags(props: {
  readonly seat: FramePlaySeat;
}): JSX.Element {
  return (
    <>
      <Show when={props.seat.standIn}>
        <Badge
          intent="warning"
          label={<Trans>Stand-in bot</Trans>}
          dataSet={{ testid: `custom-game-${props.seat.side}-stand-in` }}
        />
      </Show>
      <Show when={props.seat.committed}>
        <Badge
          intent="success"
          label={<Trans>Chosen</Trans>}
          dataSet={{ testid: `custom-game-${props.seat.side}-committed` }}
        />
      </Show>
      <Show when={props.seat.choosing}>
        <Badge intent="neutral" label={<Trans>Choosing</Trans>} />
      </Show>
      <For each={props.seat.facts}>
        {(fact) => <Badge intent="neutral" label={fact} />}
      </For>
    </>
  );
}

/**
 * A chip says one thing of its seat's standing. A seat that is away or out
 * says that (the chip's own state) and nothing of its secret choice; the
 * person's own seat says `You` and its choice in one tag.
 */
export function ChipSeatTags(props: {
  readonly seat: FramePlaySeat;
  readonly own: boolean;
}): JSX.Element {
  const settled = (): boolean => props.seat.state !== null;
  // The subtle wash over the active chip's tint falls below AA in the dark theme.
  const tone = () => (props.seat.deciding ? 'solid' : 'subtle');
  return (
    <Switch fallback={<PlaySeatTags seat={props.seat} />}>
      <Match when={props.own && !settled() && props.seat.committed}>
        <Badge
          intent="success"
          label={<Trans>You: chosen</Trans>}
          dataSet={{ testid: `custom-game-${props.seat.side}-committed` }}
        />
      </Match>
      <Match when={props.own && !settled() && props.seat.choosing}>
        <Badge
          intent="info"
          tone={tone()}
          label={<Trans>You: choosing</Trans>}
        />
      </Match>
      <Match when={props.own}>
        <Badge intent="info" tone={tone()} label={<Trans>You</Trans>} />
      </Match>
      <Match when={settled()}>
        <Show when={props.seat.standIn}>
          <Badge
            intent="warning"
            label={<Trans>Stand-in bot</Trans>}
            dataSet={{ testid: `custom-game-${props.seat.side}-stand-in` }}
          />
        </Show>
      </Match>
    </Switch>
  );
}
