import { describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  expectConverged,
  lastMutationOk,
  mutate,
  setNote,
  syncVirtualHost,
} from '../apps/acme';
import { expectLiveNoteAt } from '../apps/acme/reads';

describe('single client mutate uploads and persists', () => {
  test('single client mutate uploads and is visible locally', async () => {
    await using run = await script(acmeSystem, {
      seed: 1,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'hello' });
    expect(await run.observe(lastMutationOk('alice'))).toBe(true);

    await expectConverged(run);
    await expectLiveNoteAt(run, 'alice', 'n1', { body: 'hello' });
  });

  test('title and body both persist after converge', async () => {
    await using run = await script(acmeSystem, {
      seed: 2,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(mutate, 'alice', setNote, {
      id: 'n1',
      title: 'Greeting',
      body: 'hello',
    });
    await expectConverged(run);

    await expectLiveNoteAt(run, 'alice', 'n1', {
      body: 'hello',
      title: 'Greeting',
    });
  });
});
