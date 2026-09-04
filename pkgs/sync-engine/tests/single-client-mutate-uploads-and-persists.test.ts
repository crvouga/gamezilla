import { describe, expect, test } from 'bun:test';
import {
  addClient,
  exampleSystem,
  expectInSync,
  expectLiveNoteAt,
  lastMutationOk,
  mutate,
  setNote,
} from '@pkgs/sync-engine/sim';

describe('single client mutate uploads and persists', () => {
  test('single client mutate uploads and is visible locally', async () => {
    await using s = await exampleSystem.run({
      seed: 1,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'hello' });
    expect(await s.read(lastMutationOk, 'alice')).toBe(true);

    await expectInSync(s);
    await expectLiveNoteAt(s, 'alice', 'n1', { body: 'hello' });
  });

  test('title and body both persist after converge', async () => {
    await using s = await exampleSystem.run({
      seed: 2,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(mutate, 'alice', setNote, {
      id: 'n1',
      title: 'Greeting',
      body: 'hello',
    });
    await expectInSync(s);

    await expectLiveNoteAt(s, 'alice', 'n1', {
      body: 'hello',
      title: 'Greeting',
    });
  });
});
