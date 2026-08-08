import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  notesDomainPack,
  setNote,
} from '../../domain-packs/notes-app';
import { openSimWorld } from '../../sim/world';

describe('single client mutate uploads and persists', () => {
  test('single client mutate uploads and is visible locally', async () => {
    const world = await openSimWorld({ domain: notesDomainPack, seed: 1 });
    try {
      const a = await world.addClient({ id: 'alice' });
      const result = await a.mutate(setNote, { id: 'n1', body: 'hello' });
      expect(result.ok).toBe(true);
      await world.assertConverged();
      await expectLiveNote(a.db, 'n1', { body: 'hello' });
    } finally {
      await world.dispose();
    }
  });

  test('title and body both persist after converge', async () => {
    const world = await openSimWorld({ domain: notesDomainPack, seed: 2 });
    try {
      const a = await world.addClient({ id: 'alice' });
      await a.mutate(setNote, {
        id: 'n1',
        title: 'Greeting',
        body: 'hello',
      });
      await world.assertConverged();
      await expectLiveNote(a.db, 'n1', { body: 'hello', title: 'Greeting' });
    } finally {
      await world.dispose();
    }
  });
});
