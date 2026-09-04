import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  liveNote,
  liveNotes,
  mutate,
  online,
  setNote,
} from '../apps/acme';

describe('reupload idempotent no duplicate rows', () => {
  test('reconnect after offline set does not duplicate domain rows', async () => {
    await using s = await acmeSystem.script({
      seed: 70,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    await s.apply(online, 'alice', false);
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'once' });
    await s.apply(online, 'alice', true);
    await expectConverged(s);

    // Force another upload cycle via brief offline/online.
    await s.apply(online, 'alice', false);
    await s.elapse(20);
    await s.apply(online, 'alice', true);
    await expectConverged(s);

    expect(await s.observe(liveNote, 'bob', 'n1')).toMatchObject({
      body: 'once',
    });
    const server = await s.observe(liveNotes, 'server');
    expect(server.filter((r) => r.id === 'n1')).toHaveLength(1);
  });

  test('repeated setNote on same id keeps single live row', async () => {
    await using s = await acmeSystem.script({
      seed: 71,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'v1' });
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'v2' });
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'v3' });
    await expectConverged(s);
    const server = await s.observe(liveNotes, 'server');
    expect(server.filter((r) => r.id === 'n1')).toHaveLength(1);
    expect(await s.observe(liveNote, 'alice', 'n1')).toMatchObject({
      body: 'v3',
    });
  });
});
