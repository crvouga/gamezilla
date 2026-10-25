import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { InMemoryRoomStorage } from '@pkgs/room-adapter-memory-shared-ts/room-storage';
import fc from 'fast-check';
import { continuousRaceGame } from './reference-continuous-game';
import { liveSessionRoom } from './reference-live-session-room';
import { requestState } from './reference-simulation-room';

test('repeated authority loss preserves every published pose across tick partitions', async () => {
  await assertProperty(
    'simulation repeated authority recovery',
    fc.asyncProperty(
      fc.boolean(),
      fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 1, maxLength: 3 }),
      async (matched, partitions) => {
        let rig = await liveSessionRoom(false, continuousRaceGame, matched);
        let alice = await rig.connect('alice');
        await rig.connect('bob');
        let tick = 0;
        try {
          for (const count of partitions) {
            await rig.advance(count);
            tick += count;
            const published = await requestState(alice);
            expect(published.tick).toBe(tick);
            const topic = rig.server.topic;
            const persisted = rig.storage.exportTopic(topic)!;
            const storage = new InMemoryRoomStorage();
            storage.replaceTopic(topic, {
              ...persisted,
              dedup: persisted.dedup ?? {},
            });
            const at = rig.clock.now();
            rig.dispose();
            rig = await liveSessionRoom(false, continuousRaceGame, matched, {
              storage,
              at,
            });
            alice = await rig.connect('alice');
            await rig.connect('bob');
            const recovered = await requestState(alice);
            expect(recovered.tick).toBe(tick);
            expect(recovered.state).toBe(published.state);
            expect(recovered.epoch).not.toBe(published.epoch);
            expect(rig.errors).toEqual([]);
          }
        } finally {
          rig.dispose();
        }
      }
    )
  );
});
