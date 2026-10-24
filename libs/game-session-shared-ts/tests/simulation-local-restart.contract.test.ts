import { expect, test } from 'bun:test';
import { LocalSimulationSession } from '@libs/game-session-shared-ts/simulation-local-session';
import { SubmitSimulationInput } from '@libs/game-session-shared-ts/simulation-messages';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { continuousRaceGame } from './reference-continuous-game';
import { liveSessionRoom } from './reference-live-session-room';
import {
  localByteStorage,
  requestLocalState,
} from './reference-local-persistence';

test.each([true, 'players'] as const)(
  'local mode %s recovers its published court from bytes saved before process loss',
  async (mode) => {
    // regression: local-simulation-process-loss-rewinds-court
    const rig = await liveSessionRoom(mode);
    const bytes = new Map<string, string>();
    const alice = await rig.connect('alice', localByteStorage(bytes));
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
    let local = new LocalSimulationSession({ ...options, room: alice });
    try {
      await local.flush();
      const initial = await requestLocalState(local);
      local.send(
        SubmitSimulationInput({
          version: 1,
          epoch: initial.epoch,
          playerId: 'white',
          sequence: 1,
          tick: 4,
          value: 7,
        })
      );
      rig.clock.advance(100);
      await local.flush();
      const published = await requestLocalState(local);
      expect(published.tick).toBe(6);
      local.send(
        SubmitSimulationInput({
          version: 1,
          epoch: initial.epoch,
          playerId: 'white',
          sequence: 2,
          tick: 20,
          value: 9,
        })
      );
      const savedBytes = new Map(bytes);
      rig.clock.advance(50);
      await local.flush();
      const uninterrupted = await requestLocalState(local);
      // Cleanup cannot improve this frozen copy: it represents storage at process loss.
      local.dispose();
      alice.destroy();
      const restored = await rig.connect('alice', localByteStorage(savedBytes));
      local = new LocalSimulationSession({ ...options, room: restored });
      await local.flush();
      const recovered = await requestLocalState(local);
      expect(recovered.tick).toBe(6);
      expect(recovered.state).toBe(published.state);
      expect(recovered.epoch).not.toBe(published.epoch);
      expect(recovered.acknowledged).toEqual({});
      rig.clock.advance(50);
      await local.flush();
      expect((await requestLocalState(local)).state).toBe(uninterrupted.state);
      for (let tick = 9; tick < 20; tick++) {
        rig.clock.advance(1000 / 60);
        await local.flush();
      }
      const later = await requestLocalState(local);
      expect(later.acknowledged).toEqual({});
      expect(later.state).not.toContain('20:white:2:9');
      expect(errors).toEqual([]);
      expect(rig.errors).toEqual([]);
    } finally {
      local.dispose();
      rig.dispose();
    }
  }
);
