import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
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

type WatchedOverlay = {
  readonly phase: StageOverlayPhase;
  readonly overlay: StageOverlay;
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
  // The overlay with the phase it was last moved by: a change of phase is
  // an event only against the phase this device saw before it.
  const [watched, setWatched] = createSignal<WatchedOverlay>((previous) => {
    const to = current();
    if (previous === undefined)
      return { phase: to, overlay: stageOverlayOpening(to) };
    const event = stageOverlayPhaseEvent(previous.phase, to);
    return {
      phase: to,
      overlay:
        event === null
          ? previous.overlay
          : stageOverlayAfter(previous.overlay, event),
    };
  });
  const overlay = createMemo(() => watched().overlay);
  const send = (event: StageOverlayEvent): void => {
    setWatched((state) => ({
      phase: state.phase,
      overlay: stageOverlayAfter(state.overlay, event),
    }));
  };
  createEffect(overlay, (state) => {
    if (state.kind !== 'versus') return;
    const handle = timers.setTimeout(() => send({ type: 'tick' }), SECOND_MS);
    return () => timers.clearTimeout(handle);
  });
  return { overlay, send };
}
