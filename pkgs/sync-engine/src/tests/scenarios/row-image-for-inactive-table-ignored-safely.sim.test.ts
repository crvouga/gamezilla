import { describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  connect,
  crash,
  disconnect,
  expectConverged,
  liveFolders,
  liveNote,
  mutate,
  net,
  passTime,
  setFolder,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

describe('row image for inactive table ignored safely', () => {
  test('server folders push ignored by notesOnly peer; later note push applies', async () => {
    await using run = await script(acmeSystem, {
      seed: 807,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, {
      id: 'notesPeer',
      sessionQuery: { name: 'notesOnly', params: {} },
    });

    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'seed' });
    await run.apply(passTime, 400);
    expect(await run.observe(liveNote('notesPeer', 'n1'))).toMatchObject({
      body: 'seed',
    });
    expect(await run.observe(liveFolders('notesPeer'))).toEqual([]);

    // No optimistic fanout — only server push (table-filtered).
    await run.apply(disconnect, 'alice');
    await run.apply(mutate, 'alice', setFolder, { id: 'f1', title: 'ignored' });
    {
      await run.apply(net, 'notesPeer', 'sync', 'hold');
      await run.apply(connect, 'alice');
      await run.apply(passTime, 400);

      expect(await run.observe(liveFolders('notesPeer'))).toEqual([]);
      expect(await run.observe(liveNote('notesPeer', 'n1'))).toMatchObject({
        body: 'seed',
      });

      await run.apply(mutate, 'alice', setNote, {
        id: 'n1',
        body: 'after-ignore',
      });
      await run.apply(passTime, 300);
      expect(await run.observe(liveNote('notesPeer', 'n1'))).toMatchObject({
        body: 'after-ignore',
      });
    }
    await run.apply(crash, 'notesPeer');
    await run.apply(addClient, { id: 'bob' });
    await expectConverged(run);
  });
});
