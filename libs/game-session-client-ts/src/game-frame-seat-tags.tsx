import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import type { JSX } from '@solidjs/web';
import { For, Show } from 'solid-js';
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
 * A chip's tags, worded as on every seat (`Chosen`, `Choosing`). A seat
 * that is away or out says that (the chip's own state) and nothing of its
 * secret choice. The person's own seat is told by `ChipOwnMark` after its
 * name, never by a tag that a narrow chip may hide, and leaves out the
 * game's facts of it (their rack is in view under the seats).
 */
export function ChipSeatTags(props: {
  readonly seat: FramePlaySeat;
  readonly own: boolean;
}): JSX.Element {
  const shown = (): FramePlaySeat =>
    props.own ? { ...props.seat, facts: [] } : props.seat;
  return (
    <Show
      when={props.seat.state !== null}
      fallback={<PlaySeatTags seat={shown()} />}
    >
      <Show when={props.seat.standIn}>
        <Badge
          intent="warning"
          label={<Trans>Stand-in bot</Trans>}
          dataSet={{ testid: `custom-game-${props.seat.side}-stand-in` }}
        />
      </Show>
    </Show>
  );
}

/**
 * `You` after the person's own name on their chip, a line's height, so it
 * never gives way to the chip's facts. On the turn's tint it is filled:
 * the subtle wash over the tint falls below AA in the dark theme.
 */
export function ChipOwnMark(props: {
  readonly seat: FramePlaySeat;
}): JSX.Element {
  return (
    <Badge
      intent="info"
      size="sm"
      tone={props.seat.deciding ? 'solid' : 'subtle'}
      label={<Trans>You</Trans>}
    />
  );
}
