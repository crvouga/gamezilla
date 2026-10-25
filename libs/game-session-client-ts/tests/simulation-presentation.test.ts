import { expect, test } from 'bun:test';
import {
  connectSimulationPresentation,
  type SimulationPresentation,
} from '@libs/game-session-client-ts/simulation-presentation-session';
import {
  RequestSimulationSnapshot,
  SimulationStateChanged,
  SubmitSimulationInput,
} from '@libs/game-session-shared-ts/simulation-messages';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { raceGame } from './reference-race-game';

type Options = Parameters<typeof connectSimulationPresentation>[0];

function snapshot(epoch: string, paused: boolean, tick = 2) {
  return SimulationStateChanged({
    version: 1,
    epoch,
    revision: tick - 1,
    tick,
    paused,
    state: raceGame.registration.rules.initial(),
    acknowledged: {},
  });
}

test.each(['generation change', 'room resynchronization'] as const)(
  'a fresh running court resynchronizes after %s',
  (cause) => {
    // regression: pong-recovered-court-pause-not-observed
    const time = createHarnessClock();
    let generation = 'race:1';
    let ready = true;
    let receive: Parameters<Options['subscribeSignal']>[0] = () => {};
    let roomChanged = () => {};
    let view: SimulationPresentation = {
      position: null,
      paused: true,
      stale: true,
    };
    const requests: string[] = [];
    const position = raceGame.registration.rules.initial();
    const connection = connectSimulationPresentation({
      simulation: raceGame.registration.simulation!,
      ...time,
      generation: () => generation,
      isReady: () => ready,
      send: (message) => {
        if (RequestSimulationSnapshot.is(message)) requests.push(generation);
        return 'race-signal';
      },
      subscribeSignal: (listener) => {
        receive = listener;
        return () => {};
      },
      subscribeRoom: (listener) => {
        roomChanged = listener;
        return () => {};
      },
      measure: () => {},
      changed: (next) => (view = next),
    });
    try {
      connection.refresh();
      receive(snapshot(generation, false));
      time.clock.advance(20);
      expect(view).toEqual({ position, paused: false, stale: false });
      if (cause === 'generation change') {
        // The new signal can arrive before its durable room metadata.
        receive(snapshot('race:2', true));
        generation = 'race:2';
      } else {
        ready = false;
        roomChanged();
        // Room signals received while unsynced are intentionally discarded.
        ready = true;
      }
      roomChanged();
      expect(requests).toEqual(['race:1', generation]);
      expect(connection.replica.control('white', 1)).toBe(false);
      time.clock.advance(20);
      expect(view).toEqual({ position, paused: true, stale: true });
      receive(snapshot(generation, true));
      time.clock.advance(20);
      expect(view).toEqual({ position, paused: true, stale: false });
      roomChanged();
      expect(requests).toHaveLength(2);
    } finally {
      connection.dispose();
    }
    expect(time.clock.pendingOneShotCount()).toBe(0);
  }
);

test('a refresh keeps the control a player is still holding', () => {
  // regression: simulation-refresh-drops-held-control
  const time = createHarnessClock();
  // A game on this device becomes ready with its first court, before the
  // room says anything; the room's next change then refreshes the court.
  let ready = false;
  let receive: Parameters<Options['subscribeSignal']>[0] = () => {};
  let roomChanged = () => {};
  const held: number[] = [];
  let requests = 0;
  const connection = connectSimulationPresentation({
    simulation: raceGame.registration.simulation!,
    ...time,
    generation: () => 'race:1',
    isReady: () => ready,
    send: (message) => {
      if (RequestSimulationSnapshot.is(message)) requests += 1;
      if (SubmitSimulationInput.is(message)) held.push(message.payload.tick);
      return 'race-signal';
    },
    subscribeSignal: (listener) => {
      receive = listener;
      return () => {};
    },
    subscribeRoom: (listener) => {
      roomChanged = listener;
      return () => {};
    },
    measure: () => {},
    changed: () => {},
  });
  try {
    roomChanged();
    ready = true;
    receive(snapshot('race:1', false));
    expect(connection.replica.control('white', 7)).toBe(true);
    for (let ms = 0; ms < 100; ms += 10) time.clock.advance(10);
    expect(held.length).toBeGreaterThan(0);
    roomChanged();
    expect(requests).toBe(1);
    receive(snapshot('race:1', false, 9));
    const before = held.length;
    for (let ms = 0; ms < 200; ms += 10) time.clock.advance(10);
    // The player never let go, so the held control keeps being refreshed.
    expect(held.length).toBeGreaterThan(before);
  } finally {
    connection.dispose();
  }
});

test('a court that became ready by its own refresh keeps the held input on the next room change', () => {
  // regression: local-court-readiness-drops-held-input
  const time = createHarnessClock();
  const generation = 'race:1';
  let ready = false;
  let receive: Parameters<Options['subscribeSignal']>[0] = () => {};
  let roomChanged = () => {};
  const requests: string[] = [];
  const inputs: number[] = [];
  const connection = connectSimulationPresentation({
    simulation: raceGame.registration.simulation!,
    ...time,
    generation: () => generation,
    isReady: () => ready,
    send: (message) => {
      if (RequestSimulationSnapshot.is(message)) requests.push(generation);
      if (SubmitSimulationInput.is(message)) inputs.push(message.payload.tick);
      return 'race-signal';
    },
    subscribeSignal: (listener) => {
      receive = listener;
      return () => {};
    },
    subscribeRoom: (listener) => {
      roomChanged = listener;
      return () => {};
    },
    measure: () => {},
    changed: () => {},
  });
  try {
    roomChanged();
    // A local session settles its own queue; the room says nothing about it.
    ready = true;
    connection.refresh();
    receive(snapshot(generation, false));
    expect(connection.replica.control('white', 1)).toBe(true);
    roomChanged();
    time.clock.advance(100);
    expect(requests).toEqual([generation]);
    expect(inputs.length).toBeGreaterThan(0);
  } finally {
    connection.dispose();
  }
  expect(time.clock.pendingOneShotCount()).toBe(0);
});
