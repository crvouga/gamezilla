import { describe, expect, test } from 'bun:test';
import { openWorld } from '../../sim/world';
import {
  acmeDomainPack,
  expectLiveNote,
  expectNoteNotLive,
  isLiveNote,
  readLiveNotes,
  setNote,
} from '../apps/acme';

describe('logout login same device no bleed', () => {
  test('actor B on same device id never sees A unuploaded optimistic', async () => {
    await using world = await openWorld({
      domain: acmeDomainPack,
      seed: 960,
    });
    const phoneA = await world.addClient({
      id: 'phone',
      actorId: 'user-a',
    });
    await world.addClient({ id: 'bob', actorId: 'user-b-peer' });

    await phoneA.mutate(setNote, { id: 'a-uploaded', body: 'on-server' });
    await world.assertConverged();

    await phoneA.disconnect();
    await phoneA.mutate(setNote, {
      id: 'a-pending',
      body: 'never-upload-as-b',
    });
    await world.never(() => isLiveNote(world.server.db, 'a-pending'), {
      forMs: 50,
    });

    // Logout: dispose without preserving local DB (fresh login DB).
    await world.node('phone').crash();
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
  });

  test.each([961, 962, 963])(
    'seed sweep logout/login same device id (seed=%i)',
    async (seed) => {
      await using world = await openWorld({
        domain: acmeDomainPack,
        seed,
      });
      const phone = await world.addClient({
        id: 'phone',
        actorId: 'alice',
      });
      await phone.disconnect();
      await phone.mutate(setNote, {
        id: `pending-${seed}`,
        body: 'lost',
      });
      await world.node('phone').crash();
      const next = await world.addClient({
        id: 'phone',
        actorId: 'carol',
      });
      await expectNoteNotLive(next.db, `pending-${seed}`);
      await next.mutate(setNote, { id: `ok-${seed}`, body: 'c' });
      await world.assertConverged();
      await expectNoteNotLive(world.server.db, `pending-${seed}`);
    }
  );
});
