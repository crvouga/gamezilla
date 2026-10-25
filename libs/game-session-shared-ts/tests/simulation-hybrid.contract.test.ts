import { expect, test } from 'bun:test';
import { ChangeCustomGame } from '@libs/game-session-shared-ts/custom-game-commands';
import { assertCustomGamePosition } from '@libs/game-session-shared-ts/custom-game-position';
import { SubmitSimulationInput } from '@libs/game-session-shared-ts/simulation-messages';
import { CheckpointSimulation } from '@libs/game-session-shared-ts/simulation-session-state';
import { ROOM_SERVICE_IDENTITY } from '@pkgs/room-root-shared-ts/service-identity';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { hybridRaceGame, timedRaceCodec } from './reference-hybrid-race';
import { liveSessionRoom } from './reference-live-session-room';
import { requestState } from './reference-simulation-room';

// regression: hybrid-simulation-overwrites-discrete-command
// regression: hybrid-fractional-turn-timestamp
test('a turn accepted during live motion preserves both the turn and the advancing simulation', async () => {
  const rig = await liveSessionRoom(false, hybridRaceGame);
  try {
    const alice = await rig.connect('alice');
    const bob = await rig.connect('bob');
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
    alice.dispatch(
      ChangeCustomGame({
        gameId: rig.current().id,
        revision: rig.current().revision,
        operation: 'move',
        uci: 'advance-token',
        ply: 0,
      })
    );
    await rig.settle();
    expect(rig.errors).toEqual([]);
    expect(rig.current().moves).toHaveLength(1);
    expect(timedRaceCodec.decode(rig.current().fen)?.distance).toBeCloseTo(
      3000 / 60,
      8
    );
    await rig.advance(4);
    const after = await requestState(alice);
    expect(timedRaceCodec.decode(after.state)?.tokens).toBe(1);
    expect(after.epoch).toBe(before.epoch);
    expect(after.tick).toBe(7);
    expect(timedRaceCodec.decode(after.state)?.distance).toBeCloseTo(
      7000 / 60,
      8
    );
    expect(after.acknowledged).toEqual({ white: 1 });
    expect(timedRaceCodec.decode(after.state)?.inputs).toEqual(['6:white:1:7']);
    bob.dispatch(
      ChangeCustomGame({
        gameId: rig.current().id,
        revision: rig.current().revision,
        operation: 'move',
        uci: 'advance-token',
        ply: 1,
      })
    );
    await rig.settle();
    await rig.advance(1);
    const second = await requestState(alice);
    expect(timedRaceCodec.decode(second.state)?.tokens).toBe(2);
    expect(second.tick).toBe(8);
    expect(second.acknowledged).toEqual({ white: 1 });
    expect(rig.errors).toEqual([]);
    expect(rig.current().turnStartedAt).toBe(116);
    const registry = createTurnGames([hybridRaceGame.registration]);
    expect(() =>
      assertCustomGamePosition(rig.current(), registry)
    ).not.toThrow();
    expect(() =>
      assertCustomGamePosition({ ...rig.current(), moves: [] }, registry)
    ).toThrow('does not match its action history');
  } finally {
    rig.dispose();
  }
});

test('a hybrid registration requires an explicit command rebase rather than silently losing its turns', () => {
  const { commands: _commands, ...simulation } =
    hybridRaceGame.registration.simulation!;
  expect(() =>
    createTurnGames([{ ...hybridRaceGame.registration, simulation }])
  ).toThrow('combining turn rules and simulation requires command rebasing');
});

// regression: hybrid-queued-checkpoint-rolls-back-command
test('a queued checkpoint from before a turn cannot undo that turn at the same tick', async () => {
  const rig = await liveSessionRoom(false, hybridRaceGame);
  try {
    const alice = await rig.connect('alice');
    await rig.connect('bob');
    const before = await requestState(alice);
    const execution = rig.current().execution!;
    alice.dispatch(
      ChangeCustomGame({
        gameId: rig.current().id,
        revision: rig.current().revision,
        operation: 'move',
        uci: 'advance-token',
        ply: 0,
      })
    );
    await rig.settle();
    expect(
      timedRaceCodec.decode((await requestState(alice)).state)?.tokens
    ).toBe(1);
    const receipt = await rig.server.injectServiceCommand({
      id: 'before-turn-checkpoint',
      identity: ROOM_SERVICE_IDENTITY,
      payload: CheckpointSimulation({
        gameId: rig.current().id,
        previousEpoch: execution.epoch,
        execution,
        position: before.state,
      }),
    });
    expect(receipt.ok).toBe(true);
    await rig.settle();
    expect(
      timedRaceCodec.decode((await requestState(alice)).state)?.tokens
    ).toBe(1);
    expect(timedRaceCodec.decode(rig.current().fen)?.tokens).toBe(1);
    expect(rig.current().moves).toHaveLength(1);
    expect(rig.errors).toEqual([]);
  } finally {
    rig.dispose();
  }
});
