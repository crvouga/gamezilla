import { expect, test } from 'bun:test';
import {
  SimulationStateChanged,
  SubmitSimulationInput,
} from '@libs/game-session-shared-ts/simulation-messages';
import { InMemoryRoomStorage } from '@pkgs/room-adapter-memory-shared-ts/room-storage';
import { continuousRaceGame } from './reference-continuous-game';
import { liveSessionRoom } from './reference-live-session-room';
import { requestState } from './reference-simulation-room';

test.each([false, true])(
  'recreating matched=%s authority restores its latest published tick without a tick journal',
  async (matched) => {
    // regression: simulation-restart-loses-published-progress
    const rig = await liveSessionRoom(false, continuousRaceGame, matched);
    const alice = await rig.connect('alice');
    await rig.connect('bob');
    const initial = await requestState(alice);
    alice.sendSignal(
      SubmitSimulationInput({
        version: 1,
        epoch: initial.epoch,
        playerId: 'white',
        sequence: 1,
        tick: 4,
        value: 7,
      })
    );
    await rig.advance(6);
    const published = await requestState(alice);
    expect(published.tick).toBe(6);
    alice.sendSignal(
      SubmitSimulationInput({
        version: 1,
        epoch: initial.epoch,
        playerId: 'white',
        sequence: 2,
        tick: 20,
        value: 9,
      })
    );
    await rig.settle();
    const topic = rig.server.topic;
    const persisted = rig.storage.exportTopic(topic)!;
    const at = rig.clock.now();
    const storage = new InMemoryRoomStorage();
    storage.replaceTopic(topic, { ...persisted, dedup: persisted.dedup ?? {} });
    await rig.advance(3);
    const uninterrupted = await requestState(alice);
    rig.dispose();
    const restored = await liveSessionRoom(false, continuousRaceGame, matched, {
      storage,
      at,
    });
    try {
      const again = await restored.connect('alice');
      await restored.connect('bob');
      const recovered = await requestState(again);
      expect(recovered.tick).toBe(6);
      expect(recovered.state).toBe(published.state);
      expect(recovered.epoch).not.toBe(published.epoch);
      expect(recovered.acknowledged).toEqual({});
      await restored.advance(3);
      expect((await requestState(again)).state).toBe(uninterrupted.state);
      expect(
        (await storage.loadEventsAfter(topic, 0)).length -
          persisted.entries.length
      ).toBeLessThan(10);
      await restored.advance(11);
      const later = await requestState(again);
      expect(
        continuousRaceGame.registration.simulation!.codec.decode(later.state)
      ).toMatchObject({ inputs: ['4:white:1:7'] });
      expect(later.acknowledged).toEqual({});
      expect(restored.errors).toEqual([]);
    } finally {
      restored.dispose();
    }
  }
);

class FailedLiveStorage extends InMemoryRoomStorage {
  fail = false;
  override replaceLiveCheckpoint(
    ...args: Parameters<InMemoryRoomStorage['replaceLiveCheckpoint']>
  ) {
    return this.fail
      ? Promise.reject(new Error('live storage unavailable'))
      : super.replaceLiveCheckpoint(...args);
  }
}

test.each([false, true])(
  'a failed persistent publication retains the last visible court (matched=%s)',
  async (matched) => {
    // regression: simulation-persistence-failure-rewinds-visible-court
    const storage = new FailedLiveStorage();
    const rig = await liveSessionRoom(false, continuousRaceGame, matched, {
      storage,
      at: 0,
    });
    try {
      const alice = await rig.connect('alice');
      await rig.connect('bob');
      await rig.advance(6);
      const published = await requestState(alice);
      expect(published.tick).toBe(6);
      const delivered: number[] = [];
      const release = alice.subscribeSignal((message) => {
        if (SimulationStateChanged.is(message))
          delivered.push(message.payload.tick);
      });
      storage.fail = true;
      await rig.advance(3);
      await rig.settle();
      release();
      expect(delivered).toEqual([]);
      const final = matched ? rig.match() : rig.current();
      expect(final.execution?.tick).toBe(6);
      expect(final.fen).toBe(published.state);
      expect(rig.errors.map(String)).toEqual([
        'Error: live storage unavailable',
      ]);
      expect(rig.clock.pendingOneShotCount()).toBe(0);
    } finally {
      rig.dispose();
    }
  }
);
