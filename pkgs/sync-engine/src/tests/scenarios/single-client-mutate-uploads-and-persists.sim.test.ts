import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  lastMutationOk,
  mutate,
  setNote,
} from '../apps/acme';
import { expectLiveNoteAt } from '../apps/acme/reads';

describe('single client mutate uploads and persists', () => {
  test('single client mutate uploads and is visible locally', async () => {
    await using s = await acmeSystem.script({
      seed: 1,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'hello' });
    expect(await s.observe(lastMutationOk, 'alice')).toBe(true);

    await expectConverged(s);
    await expectLiveNoteAt(s, 'alice', 'n1', { body: 'hello' });
  });

  test('title and body both persist after converge', async () => {
    await using s = await acmeSystem.script({
      seed: 2,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(mutate, 'alice', setNote, {
      id: 'n1',
      title: 'Greeting',
      body: 'hello',
    });
    await expectConverged(s);

    await expectLiveNoteAt(s, 'alice', 'n1', {
      body: 'hello',
      title: 'Greeting',
    });
  });
});
