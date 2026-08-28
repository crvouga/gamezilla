import { describe, expect, test } from 'bun:test';
import { openSimWorld } from '../../sim/world';
import { acmeDomainPack, expectLiveNote, setNote } from '../apps/acme';

describe('single client mutate uploads and persists', () => {
  test('single client mutate uploads and is visible locally', async () => {
    await using world = await openSimWorld({
      domain: acmeDomainPack,
      seed: 1,
    });
    const a = await world.addClient({ id: 'alice' });
    const result = await a.mutate(setNote, { id: 'n1', body: 'hello' });
    expect(result.ok).toBe(true);
    await world.assertConverged();
    await expectLiveNote(a.db, 'n1', { body: 'hello' });
  });

  test('title and body both persist after converge', async () => {
    await using world = await openSimWorld({
      domain: acmeDomainPack,
      seed: 2,
    });
    const a = await world.addClient({ id: 'alice' });
    await a.mutate(setNote, {
      id: 'n1',
      title: 'Greeting',
      body: 'hello',
    });
    await world.assertConverged();
    await expectLiveNote(a.db, 'n1', { body: 'hello', title: 'Greeting' });
  });
});
