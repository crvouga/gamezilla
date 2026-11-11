import {
  type Accessor,
  createComputed,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
} from 'solid-js';
import {
  type StageOverlay,
  type StageOverlayEvent,
  type StageOverlayPhase,
  stageOverlayAfter,
  stageOverlayOpening,
  stageOverlayPhaseEvent,
} from './stage-overlay';

/** The timers the count runs on, injected (never the wall's own). */
export type StageOverlayTimers = {
  readonly setTimeout: (fn: () => void, ms: number) => unknown;
  readonly clearTimeout: (handle: unknown) => void;
};

export type StageOverlayControl = {
  /** What lies over the board now. */
  readonly overlay: Accessor<StageOverlay>;
  /** The person's own events: `skip`, `dismiss`, `show`. */
  readonly send: (event: StageOverlayEvent) => void;
};

const SECOND_MS = 1000;

/**
 * A board's overlay on this device: the phase comes from the data, the
 * rest from what the person does and from the count. Only a change of phase
 * this device watched plays the versus card; opening a game already under
 * way shows its board at once. The count never holds the game back: it
 * only covers the board for its few seconds.
 */
export function useStageOverlay(
  phase: Accessor<StageOverlayPhase>,
  timers: StageOverlayTimers
): StageOverlayControl {
  const current = createMemo(phase);
  const [overlay, setOverlay] = createSignal<StageOverlay>(
    stageOverlayOpening(current())
  );
  const send = (event: StageOverlayEvent): void => {
    setOverlay((state) => stageOverlayAfter(state, event));
  };
  // The phase last seen, kept here: `on` forgets the one it deferred.
  let seen = current();
  createComputed(
    on(
      current,
      (to) => {
        const event = stageOverlayPhaseEvent(seen, to);
        seen = to;
        if (event !== null) send(event);
      },
      { defer: true }
    )
  );
  createEffect(() => {
    const state = overlay();
    if (state.kind !== 'versus') return;
    const handle = timers.setTimeout(() => send({ type: 'tick' }), SECOND_MS);
    onCleanup(() => timers.clearTimeout(handle));
  });
  return { overlay, send };
}
