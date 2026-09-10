import { useTimers } from '@pkgs/clock/solid';
import type { AttributionHit, ParticipantColor } from '@pkgs/collab';
import { type ComponentDataSet, componentDataAttrs } from '@pkgs/ui';
import {
  createEffect,
  createSignal,
  type JSX,
  on,
  onCleanup,
  Show,
} from 'solid-js';

export type AttributionHighlightProps = {
  hit: AttributionHit | null;
  colorForActor: (actorId: string) => ParticipantColor | string;
  children: JSX.Element;
  borderRadius?: number;
  borderWidth?: number;
  dataSet?: ComponentDataSet;
};

/** Pulse on a new attribution, releasing the timer on replacement or disposal. */
export function AttributionHighlight(
  props: AttributionHighlightProps
): JSX.Element {
  const timers = useTimers();
  const [ringOn, setRingOn] = createSignal(false);
  createEffect(
    on(
      () => props.hit?.seq ?? null,
      (seq) => {
        setRingOn(seq !== null);
        if (seq === null) return;
        const timer = timers.setTimeout(() => setRingOn(false), 1200);
        onCleanup(() => timers.clearTimeout(timer));
      }
    )
  );
  const color = () => {
    if (props.hit === null) return null;
    const value = props.colorForActor(props.hit.actor.id);
    return typeof value === 'string' ? value : value.css;
  };
  return (
    <div
      class="box relative"
      {...componentDataAttrs('AttributionHighlight', props.dataSet)}
    >
      {props.children}
      <Show when={color()}>
        {(ringColor) => (
          <div
            class="box pointer-events-none absolute inset-0 [transition-property:opacity] [transition-duration:1.2s]"
            style={{
              'border-radius': `${props.borderRadius ?? 8}px`,
              'border-color': ringColor(),
              'border-width': `${props.borderWidth ?? 2}px`,
              opacity: ringOn() ? 1 : 0,
            }}
          />
        )}
      </Show>
    </div>
  );
}
