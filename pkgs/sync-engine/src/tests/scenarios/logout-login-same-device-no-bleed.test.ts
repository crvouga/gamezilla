import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  expectNoteNotLive,
  notesDomainPack,
  readLiveNotes,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

describe('logout login same device no bleed', () => {
  test('actor B on same device id never sees A unuploaded optimistic', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 960,
      faults: RELIABLE_FAULTS,
    });
    try {
      const phoneA = await world.addClient({
        id: 'phone',
        actorId: 'user-a',
      });
      await world.addClient({ id: 'bob', actorId: 'user-b-peer' });

      await phoneA.mutate(setNote, { id: 'a-uploaded', body: 'on-server' });
      await world.assertConverged();

      await phoneA.engine.disconnect();
      await phoneA.mutate(setNote, {
        id: 'a-pending',
        body: 'never-upload-as-b',
      });
      await world.runFor(50);
      await expectNoteNotLive(world.server.db, 'a-pending');

      // Logout: dispose without preserving local DB (fresh login DB).
      await world.crashClient('phone');
      const phoneB = await world.addClient({
        id: 'phone',
        actorId: 'user-b',
      });
      expect(phoneB.deviceId).toBe('device:phone');
      expect(phoneB.actorId).toBe('user-b');

      await expectNoteNotLive(phoneB.db, 'a-pending');
      expect(
        (await readLiveNotes(phoneB.db)).some((n) => n.id === 'a-pending')
      ).toBe(false);

      await phoneB.mutate(setNote, { id: 'b-note', body: 'from-b' });
      await world.assertConverged();
      await expectLiveNote(phoneB.db, 'b-note', { body: 'from-b' });
      await expectNoteNotLive(world.server.db, 'a-pending');
      await expectLiveNote(world.server.db, 'a-uploaded', {
        body: 'on-server',
      });
    } finally {
      await world.dispose();
    }
  });

  test('seed sweep logout/login same device id', async () => {
    for (const seed of [961, 962, 963] as const) {
      const world = await openSimWorld({
        domain: notesDomainPack,
        seed,
        faults: RELIABLE_FAULTS,
      });
      try {
        const phone = await world.addClient({
          id: 'phone',
          actorId: 'alice',
        });
        await phone.engine.disconnect();
        await phone.mutate(setNote, {
          id: `pending-${seed}`,
          body: 'lost',
        });
        await world.crashClient('phone');
        const next = await world.addClient({
          id: 'phone',
          actorId: 'carol',
        });
        await expectNoteNotLive(next.db, `pending-${seed}`);
        await next.mutate(setNote, { id: `ok-${seed}`, body: 'c' });
        await world.assertConverged();
        await expectNoteNotLive(world.server.db, `pending-${seed}`);
      } finally {
        await world.dispose();
      }
    }
  });
});
