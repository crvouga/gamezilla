import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { syncFacade } from '../../sim/system';
import { expectLiveNote, setNote } from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('single client mutate uploads and persists', () => {
  test('single client mutate uploads and is visible locally', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 1,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.state);
    const a = await world.addClient({ id: 'alice' });
    const result = await a.mutate(setNote, { id: 'n1', body: 'hello' });
    expect(result.ok).toBe(true);
    await world.assertConverged();
    await expectLiveNote(a.db, 'n1', { body: 'hello' });
  });

  test('title and body both persist after converge', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 2,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.state);
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
