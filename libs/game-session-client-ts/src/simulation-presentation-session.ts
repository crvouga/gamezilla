import { RequestSimulationSnapshot } from '@libs/game-simulation-shared-ts/simulation-messages';
import { SimulationReplica } from '@libs/game-simulation-shared-ts/simulation-replica';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import type { RegisteredSimulation } from '@pkgs/turn-game-shared-ts/game-simulation';

type Signal = Parameters<SimulationReplica['receive']>[0];
export type SimulationPresentation = {
  readonly position: string | null;
  readonly paused: boolean;
  readonly stale: boolean;
};

type Synced = { generation: string | undefined; ready: boolean };

/** The display's own frame callback: a court is drawn once per screen refresh. */
export type FrameScheduler = {
  readonly requestAnimationFrame: (callback: (at: number) => void) => number;
  readonly cancelAnimationFrame: (handle: number) => void;
};

type PresentationOptions = {
  readonly simulation: RegisteredSimulation;
  readonly clock: Clock;
  /**
   * Frames tied to the display's refresh. Absent: the frames of the window
   * showing the document, the same document whose visibility pauses play.
   */
  readonly frames?: FrameScheduler;
  /** Each presented frame's spacing, for frame pacing measures. */
  readonly framed?: (intervalMs: number) => void;
  readonly generation: () => string | undefined;
  readonly isReady: () => boolean;
  readonly send: (message: Signal) => string | null;
  readonly subscribeSignal: (receive: (message: Signal) => void) => () => void;
  readonly subscribeRoom: (changed: () => void) => () => void;
  readonly measure: ConstructorParameters<
    typeof SimulationReplica
  >[0]['measure'];
  readonly changed: (view: SimulationPresentation) => void;
};

/** The existing room signals feed one renderer-independent replica in every game mode. */
export function connectSimulationPresentation(options: PresentationOptions) {
  const replica = new SimulationReplica({
    simulation: options.simulation,
    clock: options.clock,
    send: options.send,
    measure: options.measure,
  });
  const unsubscribe = options.subscribeSignal((message) => {
    const generation = options.generation();
    if (generation !== undefined) replica.receive(message, generation);
  });
  const synced: Synced = {
    generation: options.generation(),
    ready: options.isReady(),
  };
  const refresh = () => {
    const generation = options.generation();
    if (generation === undefined || !options.isReady()) return;
    synced.generation = generation;
    synced.ready = true;
    replica.resynchronize();
    options.send(RequestSimulationSnapshot({ version: 1 }));
  };
  const unsubscribeRoom = subscribeSimulationRoom(
    options,
    { replica, synced },
    refresh
  );
  let position: string | null = null;
  const stopFrames = presentationFrames({
    frames: options.frames ?? documentFrames(document),
    ...(options.framed === undefined ? {} : { framed: options.framed }),
    refresh,
    release: () => replica.release(),
    frame: () => {
      const stale = !options.isReady() || replica.isStale();
      if (!stale) {
        replica.pump();
        const state = replica.sample();
        if (state !== null) position = options.simulation.codec.encode(state);
      }
      options.changed({
        position,
        paused: stale || replica.isPaused(),
        stale,
      });
    },
  });
  return {
    replica,
    refresh,
    dispose: () => {
      stopFrames();
      unsubscribe();
      unsubscribeRoom();
      replica.reset();
    },
  };
}

/**
 * Readiness can arrive without a room change (a local session settles its own
 * queue), so the last refresh, not the last notification, says what the
 * replica was synchronized to; a court already resynchronized keeps its held input.
 */
function subscribeSimulationRoom(
  options: PresentationOptions,
  view: { readonly replica: SimulationReplica; readonly synced: Synced },
  refresh: () => void
): () => void {
  const { replica, synced } = view;
  return options.subscribeRoom(() => {
    const generation = options.generation();
    const ready = options.isReady();
    const invalidated =
      synced.generation !== generation || synced.ready !== ready;
    synced.generation = generation;
    synced.ready = ready;
    if (!ready || generation === undefined) replica.reset();
    else if (invalidated || replica.isStale()) refresh();
  });
}

/** The frames of the window showing `ownerDocument`. */
function documentFrames(ownerDocument: Document): FrameScheduler {
  const view = ownerDocument.defaultView;
  if (view === null)
    throw new Error('A live game needs a document shown in a window');
  return {
    requestAnimationFrame: (callback) => view.requestAnimationFrame(callback),
    cancelAnimationFrame: (handle) => view.cancelAnimationFrame(handle),
  };
}

/**
 * One court per display refresh, drawn in the refresh's own frame callback:
 * a timer is neither tied to the display nor on time, so it shows some
 * courts twice and skips others.
 */
function presentationFrames(options: {
  frames: FrameScheduler;
  framed?: (intervalMs: number) => void;
  frame: () => void;
  refresh: () => void;
  release: () => void;
}): () => void {
  let handle: number | null = null;
  let stopped = false;
  let previous = Number.NaN;
  const ownerDocument = document;
  const visible = () => ownerDocument.visibilityState !== 'hidden';
  const cancel = () => {
    if (handle !== null) options.frames.cancelAnimationFrame(handle);
    handle = null;
  };
  const frame = (at: number) => {
    handle = null;
    if (stopped || !visible()) return;
    if (!Number.isNaN(previous)) options.framed?.(at - previous);
    previous = at;
    options.frame();
    handle = options.frames.requestAnimationFrame(frame);
  };
  const change = () => {
    cancel();
    previous = Number.NaN;
    options.release();
    if (visible()) {
      options.refresh();
      options.frame();
      handle = options.frames.requestAnimationFrame(frame);
    }
  };
  ownerDocument.addEventListener('visibilitychange', change);
  if (visible()) {
    options.frame();
    handle = options.frames.requestAnimationFrame(frame);
  }
  return () => {
    stopped = true;
    cancel();
    ownerDocument.removeEventListener('visibilitychange', change);
  };
}
