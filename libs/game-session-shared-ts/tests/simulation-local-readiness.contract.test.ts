import { expect, test } from 'bun:test';
import { CustomGamesAttr } from '@libs/game-session-shared-ts/custom-game-state';
import { LocalSimulationSession } from '@libs/game-session-shared-ts/simulation-local-session';
import { InMemoryClientStorage } from '@pkgs/room-adapter-memory-shared-ts/client-storage';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { continuousRaceGame } from './reference-continuous-game';
import { liveSessionRoom } from './reference-live-session-room';
import { requestLocalState } from './reference-local-persistence';

class DelayedReadStorage extends InMemoryClientStorage {
  release!: () => void;
  private readonly gate = new Promise<void>((resolve) => {
    this.release = resolve;
  });
  override async loadLiveCheckpoint() {
    await this.gate;
    return super.loadLiveCheckpoint();
  }
}

test('presentation waits for recovery before refreshing an existing local input epoch', async () => {
  // regression: local-simulation-refresh-before-recovery-ready
  const rig = await liveSessionRoom('players');
  const storage = new InMemoryClientStorage();
  const room = await rig.connect('alice', storage);
  rig.transports.get('alice')!.closeFromServer();
  let sequence = 0;
  const errors: unknown[] = [];
  const options = {
    owner: 'alice',
    rules: createTurnGames([continuousRaceGame.registration]),
    ...rig,
    createId: () => `local-${++sequence}`,
    onError: (error: unknown) => errors.push(error),
  };
  let local = new LocalSimulationSession({ ...options, room });
  const restoredStorage = new DelayedReadStorage();
  try {
    await local.flush();
    rig.clock.advance(100);
    await local.flush();
    await requestLocalState(local);
    const committed = await storage.loadCommitted();
    await restoredStorage.appendCommitted(committed.entries);
    await restoredStorage.saveQueued(await storage.loadQueued());
    await restoredStorage.replaceLiveCheckpoint(
      committed.lastSeq,
      (await storage.loadLiveCheckpoint())!.payload
    );
    local.dispose();
    room.destroy();
    const restored = await rig.connect('alice', restoredStorage);
    expect(
      CustomGamesAttr.from(restored.getSnapshot()).current?.execution
    ).toBeDefined();
    local = new LocalSimulationSession({ ...options, room: restored });
    expect(local.isReady()).toBe(false);
    restoredStorage.release();
    await local.flush();
    expect(local.isReady()).toBe(true);
    expect((await requestLocalState(local)).tick).toBe(6);
    expect(errors).toEqual([]);
    expect(rig.errors).toEqual([]);
    local.dispose();
    expect(local.isReady()).toBe(false);
  } finally {
    restoredStorage.release();
    local.dispose();
    rig.dispose();
  }
});
