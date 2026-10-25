import { expect, test } from 'bun:test';
import { ChangeCustomGame } from '@libs/game-session-shared-ts/custom-game-commands';
import { InMemoryRoomStorage } from '@pkgs/room-adapter-memory-shared-ts/room-storage';
import { hybridRaceGame, timedRaceCodec } from './reference-hybrid-race';
import { liveSessionRoom } from './reference-live-session-room';
import { requestState } from './reference-simulation-room';

test('a superseded recovery frame cannot take back a durably accepted hybrid choice', async () => {
  const rig = await liveSessionRoom(false, hybridRaceGame);
  const storage = new InMemoryRoomStorage();
  let at = 0;
  let accepted = '';
  try {
    const alice = await rig.connect('alice');
    await rig.connect('bob');
    await rig.advance(6);
    await requestState(alice);
    const prior = (await rig.storage.loadLiveCheckpoint(rig.server.topic))!;
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
    expect(timedRaceCodec.decode(rig.current().fen)?.tokens).toBe(1);
    accepted = rig.current().fen;
    await rig.storage.replaceLiveCheckpoint(
      rig.server.topic,
      await rig.storage.getLastSeq(rig.server.topic),
      prior.payload
    );
    const persisted = rig.storage.exportTopic(rig.server.topic)!;
    storage.replaceTopic(rig.server.topic, {
      ...persisted,
      dedup: persisted.dedup ?? {},
    });
    at = rig.clock.now();
  } finally {
    rig.dispose();
  }
  const restored = await liveSessionRoom(false, hybridRaceGame, false, {
    storage,
    at,
  });
  try {
    const alice = await restored.connect('alice');
    await restored.connect('bob');
    const frame = await requestState(alice);
    expect(frame.tick).toBe(6);
    expect(frame.state).toBe(accepted);
    expect(timedRaceCodec.decode(frame.state)?.tokens).toBe(1);
    expect(restored.current().moves).toHaveLength(1);
    expect(restored.errors).toEqual([]);
  } finally {
    restored.dispose();
  }
});
