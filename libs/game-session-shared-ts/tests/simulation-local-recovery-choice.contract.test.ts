import { expect, test } from 'bun:test';
import { CustomGamesAttr } from '@libs/game-session-shared-ts/custom-game-state';
import { LocalSimulationSession } from '@libs/game-session-shared-ts/simulation-local-session';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { hybridRaceGame, timedRaceCodec } from './reference-hybrid-race';
import { liveSessionRoom } from './reference-live-session-room';
import {
  localByteStorage,
  requestLocalState,
} from './reference-local-persistence';

test('a persisted local choice supersedes an older live recovery value after process loss', async () => {
  const rig = await liveSessionRoom('players', hybridRaceGame);
  const bytes = new Map<string, string>();
  const room = await rig.connect('alice', localByteStorage(bytes));
  rig.transports.get('alice')!.closeFromServer();
  let sequence = 0;
  const errors: unknown[] = [];
  const options = {
    owner: 'alice',
    rules: createTurnGames([hybridRaceGame.registration]),
    ...rig,
    createId: () => `local-${++sequence}`,
    onError: (error: unknown) => errors.push(error),
  };
  let local = new LocalSimulationSession({ ...options, room });
  try {
    await local.flush();
    rig.clock.advance(100);
    await local.flush();
    await requestLocalState(local);
    const prior = new Map(bytes);
    const current = () => CustomGamesAttr.from(room.getSnapshot()).current!;
    await local.choose({
      gameId: current().id,
      revision: current().revision,
      operation: 'move',
      uci: 'advance-token',
      ply: 0,
    });
    const accepted = current().fen;
    expect(timedRaceCodec.decode(accepted)?.tokens).toBe(1);
    const saved = new Map(bytes);
    for (const [key, value] of prior)
      if (key.endsWith(':live-checkpoint')) saved.set(key, value);
    local.dispose();
    room.destroy();
    const restored = await rig.connect('alice', localByteStorage(saved));
    local = new LocalSimulationSession({ ...options, room: restored });
    await local.flush();
    const frame = await requestLocalState(local);
    expect(frame.tick).toBe(6);
    expect(frame.state).toBe(accepted);
    expect(
      CustomGamesAttr.from(restored.getSnapshot()).current?.moves
    ).toHaveLength(1);
    expect(errors).toEqual([]);
    expect(rig.errors).toEqual([]);
  } finally {
    local.dispose();
    rig.dispose();
  }
});
