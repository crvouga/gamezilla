import { expect, test } from 'bun:test';
import { DecideMultiplayerGame } from '@libs/game-matchmaking-shared-ts/match-intent';
import { MultiplayerGameChanged } from '@libs/game-matchmaking-shared-ts/match-room';
import { SubmitSimulationInput } from '@libs/game-session-shared-ts/simulation-messages';
import { ROOM_SERVICE_IDENTITY } from '@pkgs/room-root-shared-ts/service-identity';
import { continuousRaceGame } from './reference-continuous-game';
import { liveSessionRoom } from './reference-live-session-room';
import { requestState } from './reference-simulation-room';

test('matched execution accepts both players, streams to late watchers, and durably completes without turn moves', async () => {
  const rig = await liveSessionRoom(false, continuousRaceGame, true);
  try {
    const alice = await rig.connect('alice');
    await rig.connect('bob');
    await rig.advance(5);
    const snapshot = await requestState(alice);
    expect(snapshot.tick).toBe(5);
    const eve = await rig.connect('eve');
    expect((await requestState(eve)).state).toBe(snapshot.state);
    eve.sendSignal(
      SubmitSimulationInput({
        version: 1,
        epoch: snapshot.epoch,
        playerId: 'white',
        sequence: 1,
        tick: 6,
        value: 99,
      })
    );
    await requestState(eve);
    await rig.advance(60);
    expect(rig.match()).toMatchObject({
      outcome: 'white',
      reason: 'finish line',
      pgn: '',
      turn: '',
    });
    expect(rig.match().execution?.phase).toBe('completed');
    expect(rig.clock.pendingOneShotCount()).toBe(0);
    expect(rig.errors).toHaveLength(1);
  } finally {
    rig.dispose();
  }
});

test('a terminal command captures the current tick, retries once, and cannot be undone by a delayed SQL projection', async () => {
  const rig = await liveSessionRoom(false, continuousRaceGame, true);
  try {
    const alice = await rig.connect('alice');
    await rig.connect('bob');
    const oldProjection = rig.match();
    await rig.advance(5);
    expect((await requestState(alice)).tick).toBe(5);
    const command = {
      id: 'resign-once',
      identity: ROOM_SERVICE_IDENTITY,
      payload: DecideMultiplayerGame({
        gameId: 'race-1',
        actorId: 'alice',
        kind: 'resign',
      }),
    };
    expect((await rig.server.injectServiceCommand(command)).ok).toBe(true);
    expect(rig.match()).toMatchObject({
      outcome: 'black',
      reason: 'resignation',
      execution: { tick: 5, started: true },
    });
    const revision = rig.match().revision;
    await rig.server.injectServiceCommand(command);
    expect(rig.match().revision).toBe(revision);
    await rig.server.injectServiceCommand({
      id: 'delayed-sql',
      identity: ROOM_SERVICE_IDENTITY,
      payload: MultiplayerGameChanged(oldProjection),
    });
    expect(rig.match()).toMatchObject({
      outcome: 'black',
      execution: { tick: 5 },
    });
    expect(rig.clock.pendingOneShotCount()).toBe(0);
    expect(rig.errors).toEqual([]);
  } finally {
    rig.dispose();
  }
});

test('a matched disconnect deadline forfeits once and releases the simulation', async () => {
  const rig = await liveSessionRoom(false, continuousRaceGame, true);
  try {
    await rig.connect('alice');
    await rig.connect('bob');
    rig.transports.get('bob')!.closeFromServer();
    await rig.settle();
    rig.clock.advance(30_000);
    await rig.settle();
    expect(rig.match()).toMatchObject({
      outcome: 'white',
      reason: 'opponent stayed away',
    });
    expect(rig.clock.pendingOneShotCount()).toBe(0);
    expect(rig.errors).toEqual([]);
  } finally {
    rig.dispose();
  }
});
