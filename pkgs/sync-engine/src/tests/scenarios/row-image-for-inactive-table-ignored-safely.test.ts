import { describe, expect, test } from 'bun:test';
import {
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
  setFolder,
  setNote,
} from '../apps/acme';

describe('row image for inactive table ignored safely', () => {
  test('server folders push ignored by notesOnly peer; later note push applies', async () => {
    await using s = await acmeSystem.script({
      seed: 807,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, {
      id: 'notesPeer',
      sessionQuery: { name: 'notesOnly', params: {} },
    });

    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'seed' });
    await s.elapse(400);
    expect(await s.observe(liveNote, 'notesPeer', 'n1')).toMatchObject({
      body: 'seed',
    });
    expect(await s.observe(liveFolders, 'notesPeer')).toEqual([]);

    // No optimistic fanout — only server push (table-filtered).
    await s.apply(disconnect, 'alice');
    await s.apply(mutate, 'alice', setFolder, { id: 'f1', title: 'ignored' });
    {
      await s.apply(net, 'notesPeer', 'sync', 'hold');
      await s.apply(connect, 'alice');
      await s.elapse(400);

      expect(await s.observe(liveFolders, 'notesPeer')).toEqual([]);
      expect(await s.observe(liveNote, 'notesPeer', 'n1')).toMatchObject({
        body: 'seed',
      });

      await s.apply(mutate, 'alice', setNote, {
        id: 'n1',
        body: 'after-ignore',
      });
      await s.elapse(300);
      expect(await s.observe(liveNote, 'notesPeer', 'n1')).toMatchObject({
        body: 'after-ignore',
      });
    }
    await s.apply(crash, 'notesPeer');
    await s.apply(addClient, { id: 'bob' });
    await expectConverged(s);
  });
});
