import { expect, test } from 'bun:test';
import { defineGame } from '@libs/game-session-shared-ts/game-definition';
import { SubmitSimulationInput } from '@libs/game-session-shared-ts/simulation-messages';
import { CheckpointSimulation } from '@libs/game-session-shared-ts/simulation-session-state';
import { WIRE_VERSION } from '@pkgs/room-root-shared-ts/wire';
import { continuousRaceGame } from './reference-continuous-game';
import { liveSessionRoom } from './reference-live-session-room';
import { requestState } from './reference-simulation-room';

test('a continuous game registers without turn methods and retains the shared product capabilities', () => {
  expect(continuousRaceGame.turnGame).toBeUndefined();
  expect(continuousRaceGame.automation).toBeUndefined();
  expect(continuousRaceGame.registration.simulation).toBeDefined();
  expect(
    continuousRaceGame.capabilities['custom-games'].bots.difficulties
  ).toEqual(['easy', 'medium', 'hard']);
});

// regression: room-live-method-context
// regression: simulation-fractional-completion-time
test('room-hosted execution applies authorized inputs without journaling every tick, then durably records its result', async () => {
  const rig = await liveSessionRoom();
  try {
    const alice = await rig.connect('alice');
    await rig.connect('bob');
    const epoch = (await requestState(alice)).epoch;
    const before = (await rig.storage.loadEventsAfter('space:race', 0)).length;
    alice.sendSignal(
      SubmitSimulationInput({
        version: 1,
        epoch,
        playerId: 'white',
        sequence: 1,
        tick: 1,
        value: 7,
      })
    );
    await requestState(alice);
    await rig.advance(5);
    const snapshot = await requestState(alice);
    expect(snapshot.tick).toBe(5);
    expect(snapshot.acknowledged).toEqual({ white: 1 });
    expect(await rig.storage.loadEventsAfter('space:race', 0)).toHaveLength(
      before
    );
    await rig.advance(60);
    expect({
      status: rig.current().status,
      errors: rig.errors,
      execution: rig.current().execution,
      position: rig.current().fen,
    }).toMatchObject({ status: 'completed', errors: [] });
    expect(rig.current().execution!.phase).toBe('completed');
    expect(rig.current().moves).toEqual([]);
    expect(rig.clock.pendingOneShotCount()).toBe(0);
    expect(
      (await rig.storage.loadEventsAfter('space:race', 0)).length
    ).toBeLessThan(15);
    expect(rig.errors).toEqual([]);
  } finally {
    rig.dispose();
  }
});

test('disconnect suspends the owned timer, reconnect resumes the same authoritative tick with neutral queued input', async () => {
  const rig = await liveSessionRoom();
  try {
    const alice = await rig.connect('alice');
    const bob = await rig.connect('bob');
    await rig.advance(3);
    const epoch = rig.current().execution!.epoch;
    const inputEpoch = (await requestState(alice)).epoch;
    alice.sendSignal(
      SubmitSimulationInput({
        version: 1,
        epoch: inputEpoch,
        playerId: 'white',
        sequence: 1,
        tick: 10,
        value: 7,
      })
    );
    await requestState(alice);
    rig.transports.get('bob')!.closeFromServer();
    await rig.settle();
    expect(rig.current().execution!.phase).toBe('paused');
    expect(rig.clock.pendingOneShotCount()).toBe(1);
    rig.clock.advance(5000);
    await rig.settle();
    expect((await requestState(alice)).tick).toBe(3);
    await rig.transports.get('bob')!.connect();
    await bob.untilSynced();
    await rig.settle();
    expect(rig.current().execution!.phase).toBe('running');
    await rig.advance(8);
    expect((await requestState(alice)).acknowledged).toEqual({});
    expect(rig.current().execution!.epoch).toBe(epoch);
    expect(rig.errors).toEqual([]);
  } finally {
    rig.dispose();
  }
});

test('a persistent absence deadline terminates a match and releases all simulation work', async () => {
  const rig = await liveSessionRoom();
  try {
    await rig.connect('alice');
    await rig.connect('bob');
    rig.transports.get('bob')!.closeFromServer();
    await rig.settle();
    rig.clock.advance(30_000);
    await rig.settle();
    expect(rig.current().status).toBe('completed');
    expect(rig.current().outcome).toStartWith('white wins');
    expect(rig.clock.pendingOneShotCount()).toBe(0);
    expect(rig.errors).toEqual([]);
  } finally {
    rig.dispose();
  }
});

// regression: simulation-reconnect-stale-control
test('a delayed tick-five control from before reconnect cannot enter the resumed input stream', async () => {
  const rig = await liveSessionRoom();
  try {
    const alice = await rig.connect('alice');
    const bob = await rig.connect('bob');
    const before = await requestState(alice);
    const stale = SubmitSimulationInput({
      version: 1,
      epoch: before.epoch,
      playerId: 'white',
      sequence: 1,
      tick: 5,
      value: 7,
    });
    rig.transports.get('bob')!.closeFromServer();
    await rig.settle();
    await rig.transports.get('bob')!.connect();
    await bob.untilSynced();
    await rig.settle();
    const resumed = await requestState(alice);
    expect(resumed.epoch).not.toBe(before.epoch);
    alice.sendSignal(stale);
    await requestState(alice);
    await rig.advance(6);
    expect((await requestState(alice)).acknowledged).toEqual({});
    expect(rig.errors).toHaveLength(1);
  } finally {
    rig.dispose();
  }
});

test('untrusted room commands cannot forge a simulation checkpoint', async () => {
  const rig = await liveSessionRoom();
  try {
    await rig.connect('alice');
    await rig.connect('bob');
    const before = rig.current().fen;
    const checkpoint = CheckpointSimulation({
      gameId: rig.current().id,
      position: before,
      previousEpoch: rig.current().execution!.epoch,
      execution: rig.current().execution!,
    });
    await rig.server.handleClientMessage('alice', 'alice', {
      v: WIRE_VERSION,
      kind: 'command',
      id: 'forged',
      ts: 0,
      payload: checkpoint,
    });
    expect(
      (await rig.storage.getDedupOutcome('space:race', 'forged'))?.kind
    ).toBe('rejected');
    expect(rig.current().fen).toBe(before);
  } finally {
    rig.dispose();
  }
});

// regression: simulation-failure-orphaned-match
test('a failed authoritative step cancels its game from the last valid checkpoint and releases every timer', async () => {
  const definition = defineGame({
    rules: continuousRaceGame.registration.rules,
    capabilities: continuousRaceGame.capabilities,
    simulation: {
      ...continuousRaceGame.registration.simulation!,
      step: () => {
        throw new Error('injected simulation failure');
      },
    },
  });
  const rig = await liveSessionRoom(false, definition);
  try {
    await rig.connect('alice');
    await rig.connect('bob');
    await rig.advance(1);
    expect(rig.current().status).toBe('cancelled');
    expect(rig.current().execution?.phase).toBe('abandoned');
    expect(rig.current().execution?.tick).toBe(0);
    expect(rig.errors).toHaveLength(1);
    expect(rig.clock.pendingOneShotCount()).toBe(0);
  } finally {
    rig.dispose();
  }
});
