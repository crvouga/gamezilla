import { RequestSimulationSnapshot } from '@libs/game-session-shared-ts/simulation-messages';
import { SimulationReplica } from '@libs/game-session-shared-ts/simulation-replica';
import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import type { RegisteredSimulation } from '@pkgs/turn-game-shared-ts/game-simulation';

type Signal = Parameters<SimulationReplica['receive']>[0];
export type SimulationPresentation = {
  readonly position: string | null;
  readonly paused: boolean;
  readonly stale: boolean;
};

type Synced = { generation: string | undefined; ready: boolean };

type PresentationOptions = {
  readonly simulation: RegisteredSimulation;
  readonly clock: Clock;
  readonly timers: Timers;
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
    timers: options.timers,
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

function presentationFrames(options: {
  timers: Timers;
  frame: () => void;
  refresh: () => void;
  release: () => void;
}): () => void {
  let timer: unknown;
  let stopped = false;
  const ownerDocument = document;
  const visible = () => ownerDocument.visibilityState !== 'hidden';
  const frame = () => {
    if (stopped || !visible()) return;
    options.frame();
    timer = options.timers.setTimeout(frame, 1000 / 60);
  };
  const change = () => {
    options.timers.clearTimeout(timer);
    options.release();
    if (visible()) {
      options.refresh();
      frame();
    }
  };
  ownerDocument.addEventListener('visibilitychange', change);
  frame();
  return () => {
    stopped = true;
    options.timers.clearTimeout(timer);
    ownerDocument.removeEventListener('visibilitychange', change);
  };
}
