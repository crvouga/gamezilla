import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeKnobs,
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
  syncVirtualHost,
} from '../apps/acme';

describe('logout login same device no bleed', () => {
  test('actor B on same device id never sees A unuploaded optimistic', async () => {
    await using run = await start(acmeSystem, {
      seed: 960,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'phone', actorId: 'user-a' });
    await run.apply(addClient, { id: 'bob', actorId: 'user-b-peer' });

    await run.apply(mutate, 'phone', setNote, {
      id: 'a-uploaded',
      body: 'on-server',
    });
    await expectConverged(run);

    await run.apply(disconnect, 'phone');
    await run.apply(mutate, 'phone', setNote, {
      id: 'a-pending',
      body: 'never-upload-as-b',
    });
    await neverAcme(run, liveNote('server', 'a-pending'), {
      forMs: 50,
      pred: noteLive,
    });

    // Logout: dispose without preserving local DB (fresh login DB).
    await run.apply(crash, 'phone');
    await run.apply(addClient, { id: 'phone', actorId: 'user-b' });
    expect(await run.observe(deviceId('phone'))).toBe('device:phone');
    expect(await run.observe(actorId('phone'))).toBe('user-b');

    expect(await run.observe(liveNote('phone', 'a-pending'))).toBeNull();
    expect(
      (await run.observe(liveNotes('phone'))).some((n) => n.id === 'a-pending')
    ).toBe(false);

    await run.apply(mutate, 'phone', setNote, { id: 'b-note', body: 'from-b' });
    await expectConverged(run);
    expect(await run.observe(liveNote('phone', 'b-note'))).toMatchObject({
      body: 'from-b',
    });
    expect(await run.observe(liveNote('server', 'a-pending'))).toBeNull();
    expect(await run.observe(liveNote('server', 'a-uploaded'))).toMatchObject({
      body: 'on-server',
    });
  });

  test.each([961, 962, 963])(
    'seed sweep logout/login same device id (seed=%i)',
    async (seed) => {
      await using run = await start(acmeSystem, {
        seed: seed,
        host: syncVirtualHost(),
        knobs: acmeKnobs({ clientCount: 0 }),
        properties: [],
      });

      await run.apply(addClient, { id: 'phone', actorId: 'alice' });
      await run.apply(disconnect, 'phone');
      await run.apply(mutate, 'phone', setNote, {
        id: `pending-${seed}`,
        body: 'lost',
      });
      await run.apply(crash, 'phone');
      await run.apply(addClient, { id: 'phone', actorId: 'carol' });
      expect(
        await run.observe(liveNote('phone', `pending-${seed}`))
      ).toBeNull();
      await run.apply(mutate, 'phone', setNote, {
        id: `ok-${seed}`,
        body: 'c',
      });
      await expectConverged(run);
      expect(
        await run.observe(liveNote('server', `pending-${seed}`))
      ).toBeNull();
    }
  );
});
