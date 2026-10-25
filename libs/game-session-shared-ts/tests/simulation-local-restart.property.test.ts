import { expect, test } from 'bun:test';
import { LocalSimulationSession } from '@libs/game-session-shared-ts/simulation-local-session';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import fc from 'fast-check';
import { continuousRaceGame } from './reference-continuous-game';
import { liveSessionRoom } from './reference-live-session-room';
import {
  localByteStorage,
  requestLocalState,
} from './reference-local-persistence';

test('local published progress survives repeated process loss across tick partitions', async () => {
  await assertProperty(
    'local simulation repeated process loss',
    fc.asyncProperty(
      fc.boolean(),
      fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 1, maxLength: 3 }),
      async (bot, partitions) => {
        const rig = await liveSessionRoom(bot ? true : 'players');
        let bytes = new Map<string, string>();
        let room = await rig.connect('alice', localByteStorage(bytes));
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
        let tick = 0;
        try {
          await local.flush();
          for (const count of partitions) {
            rig.clock.advance((count * 1000) / 60);
            await local.flush();
            tick += count;
            const published = await requestLocalState(local);
            expect(published.tick).toBe(tick);
            const saved = new Map(bytes);
            local.dispose();
            room.destroy();
            bytes = saved;
            room = await rig.connect('alice', localByteStorage(bytes));
            rig.transports.get('alice')!.closeFromServer();
            local = new LocalSimulationSession({ ...options, room });
            await local.flush();
            const recovered = await requestLocalState(local);
            expect(recovered.tick).toBe(tick);
            expect(recovered.state).toBe(published.state);
            expect(recovered.epoch).not.toBe(published.epoch);
            expect(recovered.acknowledged).toEqual({});
          }
          expect(errors).toEqual([]);
          expect(rig.errors).toEqual([]);
        } finally {
          local.dispose();
          rig.dispose();
        }
      }
    )
  );
});
