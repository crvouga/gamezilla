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
  const refresh = () => {
    if (options.generation() === undefined || !options.isReady()) return;
    replica.resynchronize();
    options.send(RequestSimulationSnapshot({ version: 1 }));
  };
  const unsubscribeRoom = subscribeSimulationRoom(options, replica, refresh);
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

function subscribeSimulationRoom(
  options: PresentationOptions,
  replica: SimulationReplica,
  refresh: () => void
): () => void {
  let generation = options.generation();
  let ready = options.isReady();
  return options.subscribeRoom(() => {
    const nextGeneration = options.generation();
    const nextReady = options.isReady();
    const invalidated = generation !== nextGeneration || ready !== nextReady;
    generation = nextGeneration;
    ready = nextReady;
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
