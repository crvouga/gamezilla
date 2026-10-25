import { expect, test } from 'bun:test';
import { LocalSimulationSession } from '@libs/game-session-shared-ts/simulation-local-session';
import {
  RequestSimulationSnapshot,
  SimulationStateChanged,
  SubmitSimulationInput,
} from '@libs/game-session-shared-ts/simulation-messages';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { continuousRaceGame } from './reference-continuous-game';
import { liveSessionRoom } from './reference-live-session-room';

// regression: local-simulation-viewers-receive-no-live-court
test('a late viewer receives the local court and follows it again after the owner returns', async () => {
  const rig = await liveSessionRoom('players');
  const alice = await rig.connect('alice');
  const errors: unknown[] = [];
  let sequence = 0;
  const local = new LocalSimulationSession({
    room: alice,
    owner: 'alice',
    rules: createTurnGames([continuousRaceGame.registration]),
    ...rig,
    createId: () => `local-${++sequence}`,
    onError: (error) => errors.push(error),
  });
  const forward = local.subscribe((message) => alice.sendSignal(message));
  try {
    await local.flush();
    rig.clock.advance(50);
    await local.flush();
    await rig.settle();
    const eve = await rig.connect('eve');
    const snapshots: ReturnType<typeof SimulationStateChanged>['payload'][] =
      [];
    eve.subscribeSignal((message) => {
      if (SimulationStateChanged.is(message)) snapshots.push(message.payload);
    });
    eve.sendSignal(RequestSimulationSnapshot({ version: 1 }));
    await rig.settle();
    const before = snapshots.at(-1);
    expect(before).toMatchObject({ tick: 3, paused: false });
    rig.transports.get('alice')!.closeFromServer();
    await rig.settle();
    rig.clock.advance(50);
    await local.flush();
    await rig.settle();
    expect(snapshots.at(-1)).toMatchObject({
      tick: 3,
      state: before!.state,
      paused: true,
    });
    await rig.transports.get('alice')!.connect();
    await alice.untilSynced();
    rig.clock.advance(50);
    await local.flush();
    await rig.settle();
    expect(snapshots.at(-1)).toMatchObject({ tick: 9, paused: false });
    expect(errors).toEqual([]);
    expect(rig.errors).toEqual([]);
  } finally {
    forward();
    local.dispose();
    rig.dispose();
  }
});

test('a viewer cannot publish or control local play and stale owner courts cannot replace it', async () => {
  const rig = await liveSessionRoom('players');
  const alice = await rig.connect('alice');
  const errors: unknown[] = [];
  const local = new LocalSimulationSession({
    room: alice,
    owner: 'alice',
    rules: createTurnGames([continuousRaceGame.registration]),
    ...rig,
    createId: () => 'local-control',
    onError: (error) => errors.push(error),
  });
  const source: ReturnType<typeof SimulationStateChanged>['payload'][] = [];
  const forward = local.subscribe((message) => {
    if (SimulationStateChanged.is(message)) source.push(message.payload);
    alice.sendSignal(message);
  });
  try {
    await local.flush();
    rig.clock.advance(50);
    await local.flush();
    await rig.settle();
    const eve = await rig.connect('eve');
    const seen: ReturnType<typeof SimulationStateChanged>['payload'][] = [];
    eve.subscribeSignal((message) => {
      if (SimulationStateChanged.is(message)) seen.push(message.payload);
    });
    eve.sendSignal(RequestSimulationSnapshot({ version: 1 }));
    await rig.settle();
    const before = seen.at(-1)!;
    const current = source.at(-1)!;
    eve.sendSignal(
      SimulationStateChanged({ ...current, revision: 99, tick: 4 })
    );
    eve.sendSignal(
      SubmitSimulationInput({
        version: 1,
        epoch: current.epoch,
        playerId: 'white',
        sequence: 1,
        tick: 4,
        value: 7,
      })
    );
    alice.sendSignal(
      SimulationStateChanged({ ...current, epoch: 'old-local-game' })
    );
    alice.sendSignal(
      SimulationStateChanged({
        ...current,
        revision: 99,
        state: 'invalid-race',
      })
    );
    alice.sendSignal(
      SimulationStateChanged({ ...current, revision: 99, tick: 2 })
    );
    await rig.settle();
    expect(seen.at(-1)).toEqual(before);
    expect(rig.errors).toHaveLength(4);
    rig.clock.advance(50);
    await local.flush();
    await rig.settle();
    expect(seen.at(-1)).toMatchObject({ tick: 6, acknowledged: {} });
    expect(errors).toEqual([]);
  } finally {
    forward();
    local.dispose();
    rig.dispose();
  }
});
