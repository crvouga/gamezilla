import { expect, test } from 'bun:test';
import { CustomGamesAttr } from '@libs/game-session-shared-ts/custom-game-state';
import { LocalSimulationSession } from '@libs/game-session-shared-ts/simulation-local-session';
import { InMemoryClientStorage } from '@pkgs/room-adapter-memory-shared-ts/client-storage';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { continuousRaceGame } from './reference-continuous-game';
import { liveSessionRoom } from './reference-live-session-room';
import { requestLocalState } from './reference-local-persistence';

class UnreadableLiveStorage extends InMemoryClientStorage {
  fail = true;
  override async loadLiveCheckpoint() {
    if (this.fail) throw new Error('saved court temporarily unreadable');
    return super.loadLiveCheckpoint();
  }
}

test('reopening after a failed local restore retries storage and starts no orphan timer', async () => {
  // regression: client-live-recovery-read-error-blocks-retry
  const rig = await liveSessionRoom('players');
  const storage = new UnreadableLiveStorage();
  const room = await rig.connect('alice', storage);
  rig.transports.get('alice')!.closeFromServer();
  const queued = await storage.loadQueued();
  let sequence = 0;
  const errors: unknown[] = [];
  const options = {
    room,
    owner: 'alice',
    rules: createTurnGames([continuousRaceGame.registration]),
    ...rig,
    createId: () => `local-${++sequence}`,
    onError: (error: unknown) => errors.push(error),
  };
  let local = new LocalSimulationSession(options);
  try {
    await expect(local.flush()).rejects.toThrow(
      'saved court temporarily unreadable'
    );
    expect(CustomGamesAttr.from(room.getSnapshot()).current?.status).toBe(
      'active'
    );
    expect(await storage.loadQueued()).toEqual(queued);
    expect(rig.clock.pendingOneShotCount()).toBe(0);
    local.dispose();
    storage.fail = false;
    local = new LocalSimulationSession(options);
    await local.flush();
    rig.clock.advance(100);
    await local.flush();
    expect((await requestLocalState(local)).tick).toBe(6);
    expect(errors.map(String)).toEqual([
      'Error: saved court temporarily unreadable',
    ]);
    expect(rig.errors.map(String)).toEqual([
      'Error: saved court temporarily unreadable',
    ]);
  } finally {
    local.dispose();
    rig.dispose();
  }
});
