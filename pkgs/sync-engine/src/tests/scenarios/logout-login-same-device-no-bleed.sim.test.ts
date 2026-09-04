import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  actorId,
  addClient,
  crash,
  deviceId,
  disconnect,
  expectConverged,
  liveNote,
  liveNotes,
  mutate,
  neverAcme,
  noteLive,
  setNote,
} from '../apps/acme';

describe('logout login same device no bleed', () => {
  test('actor B on same device id never sees A unuploaded optimistic', async () => {
    await using s = await acmeSystem.script({
      seed: 960,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'phone', actorId: 'user-a' });
    await s.apply(addClient, { id: 'bob', actorId: 'user-b-peer' });

    await s.apply(mutate, 'phone', setNote, {
      id: 'a-uploaded',
      body: 'on-server',
    });
    await expectConverged(s);

    await s.apply(disconnect, 'phone');
    await s.apply(mutate, 'phone', setNote, {
      id: 'a-pending',
      body: 'never-upload-as-b',
    });
    await neverAcme(s, (s) => liveNote(s, 'server', 'a-pending'), {
      forMs: 50,
      pred: noteLive,
    });

    // Logout: dispose without preserving local DB (fresh login DB).
    await s.apply(crash, 'phone');
    await s.apply(addClient, { id: 'phone', actorId: 'user-b' });
    expect(await s.observe(deviceId, 'phone')).toBe('device:phone');
    expect(await s.observe(actorId, 'phone')).toBe('user-b');

    expect(await s.observe(liveNote, 'phone', 'a-pending')).toBeNull();
    expect(
      (await s.observe(liveNotes, 'phone')).some((n) => n.id === 'a-pending')
    ).toBe(false);

    await s.apply(mutate, 'phone', setNote, { id: 'b-note', body: 'from-b' });
    await expectConverged(s);
    expect(await s.observe(liveNote, 'phone', 'b-note')).toMatchObject({
      body: 'from-b',
    });
    expect(await s.observe(liveNote, 'server', 'a-pending')).toBeNull();
    expect(await s.observe(liveNote, 'server', 'a-uploaded')).toMatchObject({
      body: 'on-server',
    });
  });

  test.each([961, 962, 963])(
    'seed sweep logout/login same device id (seed=%i)',
    async (seed) => {
      await using s = await acmeSystem.script({
        seed: seed,
        args: { clientCount: 0 },
      });

      await s.apply(addClient, { id: 'phone', actorId: 'alice' });
      await s.apply(disconnect, 'phone');
      await s.apply(mutate, 'phone', setNote, {
        id: `pending-${seed}`,
        body: 'lost',
      });
      await s.apply(crash, 'phone');
      await s.apply(addClient, { id: 'phone', actorId: 'carol' });
      expect(await s.observe(liveNote, 'phone', `pending-${seed}`)).toBeNull();
      await s.apply(mutate, 'phone', setNote, {
        id: `ok-${seed}`,
        body: 'c',
      });
      await expectConverged(s);
      expect(await s.observe(liveNote, 'server', `pending-${seed}`)).toBeNull();
    }
  );
});
