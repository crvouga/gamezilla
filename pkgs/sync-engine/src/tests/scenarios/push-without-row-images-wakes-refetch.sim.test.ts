import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  converge,
  liveNote,
  mutate,
  setNoteNoFanout,
  syncVirtualHost,
} from '../apps/acme';

describe('push without row images wakes refetch', () => {
  test('mutation without capture images converges via wake+refetch with rowImageFanout', async () => {
    // rowImageFanout true: proves pushSeq-only pushes still wake peers when images absent.
    await using run = await start(acmeSystem, {
      seed: 680,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');

    await run.apply(mutate, 'alice', setNoteNoFanout, {
      id: 'n1',
      body: 'no-images',
    });
    await run.apply(converge);

    expect(await run.observe(liveNote('bob', 'n1'))).toMatchObject({
      body: 'no-images',
    });
  });
});
