import { expect, test } from 'bun:test';
import { DecideMultiplayerGame } from '@libs/game-matchmaking-shared-ts/match-intent';
import { SubmitSimulationInput } from '@libs/game-session-shared-ts/simulation-messages';
import { CheckpointSimulation } from '@libs/game-session-shared-ts/simulation-session-state';
import { ROOM_SERVICE_IDENTITY } from '@pkgs/room-root-shared-ts/service-identity';
import { hybridRaceGame, timedRaceCodec } from './reference-hybrid-race';
import { liveSessionRoom } from './reference-live-session-room';
import { requestState } from './reference-simulation-room';

// regression: hybrid-match-checkpoint-erases-turn
test('simulation checkpoints preserve a matched hybrid game’s actual turn owner', async () => {
  const rig = await liveSessionRoom(false, hybridRaceGame, true);
  try {
    await rig.connect('alice');
    await rig.connect('bob');
    await rig.advance(3);
    expect(rig.match().turn).toBe('alice');
    expect(rig.match().outcome).toBe('ongoing');
    expect(rig.errors).toEqual([]);
  } finally {
    rig.dispose();
  }
});

// regression: hybrid-matched-checkpoint-rolls-back-command
test('a matched checkpoint queued before a turn cannot restore its earlier command state', async () => {
  const rig = await liveSessionRoom(false, hybridRaceGame, true);
  try {
    const alice = await rig.connect('alice');
    await rig.connect('bob');
    const before = await requestState(alice);
    const execution = rig.match().execution!;
    const moved = await rig.server.injectServiceCommand({
      id: 'matched-hybrid-first-turn',
      identity: ROOM_SERVICE_IDENTITY,
      payload: DecideMultiplayerGame({
        gameId: rig.match().id,
        actorId: 'alice',
        kind: 'move',
        revision: rig.match().revision,
        uci: 'advance-token',
        setups: null,
      }),
    });
    expect(moved.ok).toBe(true);
    const stale = await rig.server.injectServiceCommand({
      id: 'matched-hybrid-before-turn-checkpoint',
      identity: ROOM_SERVICE_IDENTITY,
      payload: CheckpointSimulation({
        gameId: rig.match().id,
        position: before.state,
        previousEpoch: execution.epoch,
        execution,
      }),
    });
    expect(stale.ok).toBe(true);
    expect(
      timedRaceCodec.decode((await requestState(alice)).state)?.tokens
    ).toBe(1);
    expect(rig.match().pgn).toBe('1');
    expect(rig.match().turn).toBe('bob');
    expect(rig.errors).toEqual([]);
  } finally {
    rig.dispose();
  }
});

// regression: hybrid-match-move-bypasses-live-authority
test('a matched turn is decided once against live mechanics and returns a retryable receipt', async () => {
  const rig = await liveSessionRoom(false, hybridRaceGame, true);
  try {
    const alice = await rig.connect('alice');
    await rig.connect('bob');
    await rig.advance(3);
    const before = await requestState(alice);
    alice.sendSignal(
      SubmitSimulationInput({
        version: 1,
        epoch: before.epoch,
        playerId: 'white',
        sequence: 1,
        tick: 6,
        value: 7,
      })
    );
    await requestState(alice);
    const command = {
      id: 'hybrid-accepted-turn',
      identity: ROOM_SERVICE_IDENTITY,
      payload: DecideMultiplayerGame({
        gameId: rig.match().id,
        actorId: 'alice',
        kind: 'move',
        revision: rig.match().revision,
        uci: 'advance-token',
        setups: null,
      }),
    };
    const first = await rig.server.injectServiceCommand(command);
    expect(first.ok).toBe(true);
    await rig.settle();
    await rig.advance(4);
    const after = await requestState(alice);
    expect(timedRaceCodec.decode(after.state)?.tokens).toBe(1);
    expect(after.tick).toBe(7);
    expect(after.acknowledged).toEqual({ white: 1 });
    expect(rig.match().turn).toBe('bob');
    expect(rig.match().pgn).toBe('1');
    const repeated = await rig.server.injectServiceCommand(command);
    expect(repeated.ok).toBe(true);
    expect(
      timedRaceCodec.decode((await requestState(alice)).state)?.tokens
    ).toBe(1);
    expect(rig.errors).toEqual([]);
  } finally {
    rig.dispose();
  }
});
