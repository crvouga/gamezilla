import { useTimers } from '@pkgs/clock/solid';
import type { AttributionHit, ParticipantColor } from '@pkgs/collab';
import { Box, type ComponentDataSet, componentDataAttrs } from '@pkgs/ui';
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
    <Box
      {...componentDataAttrs('AttributionHighlight', props.dataSet)}
      sx={{ position: 'relative' }}
    >
      {props.children}
      <Show when={color()}>
        {(ringColor) => (
          <Box
            sx={{
              pointerEvents: 'none',
              absoluteFill: true,
              borderRadius: props.borderRadius ?? 8,
              borderWidth: props.borderWidth ?? 2,
              borderColor: ringColor(),
              opacity: ringOn() ? 1 : 0,
              transitionProperty: 'opacity',
              transitionDuration: '1.2s',
            }}
          />
        )}
      </Show>
    </Box>
  );
}
