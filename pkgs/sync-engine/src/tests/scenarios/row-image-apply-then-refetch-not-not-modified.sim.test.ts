import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  expectConverged,
  liveNote,
  mutate,
  net,
  nudge,
  passTime,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

describe('row image apply then refetch not not modified', () => {
  test('live row-image paint while sync held still converges after refetch', async () => {
    // Row images must not advance content hash; release+refetch stays sound.
    await using run = await start(acmeSystem, {
      seed: 801,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });

    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'seed' });
    await run.apply(mutate, 'alice', setNote, { id: 'n2', body: 'other' });
    await expectConverged(run);

    {
      await run.apply(net, 'bob', 'sync', 'hold');
      await run.apply(mutate, 'alice', setNote, {
        id: 'n1',
        body: 'via-image',
      });
      await run.apply(passTime, 300);
      expect(await run.observe(liveNote('bob', 'n1'))).toMatchObject({
        body: 'via-image',
      });
      expect(await run.observe(liveNote('bob', 'n2'))).toMatchObject({
        body: 'other',
      });
    }
    // nudge: release sync — refetch must not be not-modified after row-image paint
    await run.apply(nudge, 'bob');
    await expectConverged(run);
    expect(await run.observe(liveNote('bob', 'n1'))).toMatchObject({
      body: 'via-image',
    });
  });
});
