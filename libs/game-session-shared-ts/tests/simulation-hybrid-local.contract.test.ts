import { expect, test } from 'bun:test';
import { CustomGamesAttr } from '@libs/game-session-shared-ts/custom-game-state';
import { LocalSimulationSession } from '@libs/game-session-shared-ts/simulation-local-session';
import {
  RequestSimulationSnapshot,
  SimulationStateChanged,
  SubmitSimulationInput,
} from '@libs/game-session-shared-ts/simulation-messages';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { hybridRaceGame, timedRaceCodec } from './reference-hybrid-race';
import { liveSessionRoom } from './reference-live-session-room';

async function localHybrid() {
  const rig = await liveSessionRoom('players', hybridRaceGame);
  const alice = await rig.connect('alice');
  rig.transports.get('alice')!.closeFromServer();
  const errors: unknown[] = [];
  let sequence = 0;
  const local = new LocalSimulationSession({
    room: alice,
    owner: 'alice',
    rules: createTurnGames([hybridRaceGame.registration]),
    ...rig,
    createId: () => `local-${++sequence}`,
    onError: (error) => errors.push(error),
  });
  await local.flush();
  return { rig, alice, local, errors };
}

async function snapshot(local: LocalSimulationSession) {
  const values: ReturnType<typeof SimulationStateChanged>['payload'][] = [];
  const unsubscribe = local.subscribe((message) => {
    if (SimulationStateChanged.is(message)) values.push(message.payload);
  });
  local.send(RequestSimulationSnapshot({ version: 1 }));
  await local.flush();
  unsubscribe();
  const value = values.at(-1);
  if (value === undefined) throw new Error('local snapshot missing');
  return value;
}

// regression: hybrid-local-choice-loses-live-progress
// regression: local-custom-choice-fractional-timestamp
test('an offline turn saves current live progress before its choice and replays both on return', async () => {
  const { rig, alice, local, errors } = await localHybrid();
  const current = () => CustomGamesAttr.from(alice.getSnapshot()).current!;
  try {
    for (let index = 0; index < 7; index++) {
      rig.clock.advance(1000 / 60);
      await local.flush();
    }
    const before = await snapshot(local);
    local.send(
      SubmitSimulationInput({
        version: 1,
        epoch: before.epoch,
        playerId: 'white',
        sequence: 1,
        tick: 10,
        value: 7,
      })
    );
    await local.choose({
      gameId: current().id,
      revision: current().revision,
      operation: 'move',
      uci: 'advance-token',
      ply: 0,
    });
    expect(current().moves).toHaveLength(1);
    expect(timedRaceCodec.decode(current().fen)?.distance).toBeCloseTo(
      7000 / 60,
      8
    );
    expect(timedRaceCodec.decode(current().fen)?.tokens).toBe(1);
    expect(current().execution?.tick).toBe(7);
    for (let index = 0; index < 4; index++) {
      rig.clock.advance(1000 / 60);
      await local.flush();
    }
    const after = await snapshot(local);
    expect(after).toMatchObject({
      epoch: before.epoch,
      tick: 11,
      acknowledged: { white: 1 },
    });
    expect(timedRaceCodec.decode(after.state)).toMatchObject({
      tokens: 1,
      inputs: ['10:white:1:7'],
    });
    await rig.transports.get('alice')!.connect();
    await alice.untilSynced();
    await rig.settle();
    await local.flush();
    expect(rig.current().fen).toBe(current().fen);
    expect(rig.current().moves).toHaveLength(1);
    expect(errors).toEqual([]);
    expect(rig.errors).toEqual([]);
  } finally {
    local.dispose();
    rig.dispose();
  }
});
