import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { assertFaultPins, assertSample } from '@pkgs/determinism/pbt';
import { ownerTabId } from './ownership';
import { SQL_CLIENT_WEB_SYSTEM } from './system';
import { readToyRows } from './toy-kv';

const OPFS = { tabCount: 2, backend: 'web-sim-opfs' } as const;

describe('sql-client web multi-tab system PBT', () => {
  test('assertSample explores tabs, pool exhaustion, corruption, epochs', async () => {
    await assertSample(SQL_CLIENT_WEB_SYSTEM, { maxCommands: 10, numRuns: 4 });
  }, 180_000);

  test('named fault pins recover to a usable cache', async () => {
    await assertFaultPins(
      SQL_CLIENT_WEB_SYSTEM,
      [
        {
          name: 'fill-pool-then-connect',
          knobs: OPFS,
          actions: [
            { kind: 'fillPool' },
            { kind: 'connect', tabId: 't0' },
            { kind: 'put', tabId: 't0', key: 'a', value: '1' },
            { kind: 'get', tabId: 't0', key: 'a' },
          ],
        },
        {
          name: 'corrupt-then-connect',
          knobs: OPFS,
          actions: [
            { kind: 'corruptStore' },
            { kind: 'connect', tabId: 't0' },
            { kind: 'put', tabId: 't0', key: 'a', value: '1' },
            { kind: 'get', tabId: 't0', key: 'a' },
          ],
        },
        {
          name: 'bump-epoch-clears-rows',
          knobs: OPFS,
          actions: [
            { kind: 'connect', tabId: 't0' },
            { kind: 'put', tabId: 't0', key: 'a', value: '1' },
            { kind: 'bumpEpoch' },
            { kind: 'killTab', tabId: 't0' },
            { kind: 'connect', tabId: 't0' },
            { kind: 'get', tabId: 't0', key: 'a' },
          ],
        },
        {
          name: 'kill-owner-promotes-peer',
          knobs: OPFS,
          actions: [
            { kind: 'connect', tabId: 't0' },
            { kind: 'connect', tabId: 't1' },
            { kind: 'put', tabId: 't0', key: 'a', value: '1' },
            { kind: 'killTab', tabId: 't0' },
            { kind: 'get', tabId: 't1', key: 'a' },
          ],
        },
      ],
      { numRuns: 2 }
    );
  }, 120_000);

  test('openWorld boots a store plus tabs and elects one owner', async () => {
    await using world = await openWorld(SQL_CLIENT_WEB_SYSTEM, {
      seed: 7,
      knobs: OPFS,
    });
    expect(world.node('store').kind).toBe('sql-client.web.store');
    expect(world.roleIds('tab')).toEqual(['t0', 't1']);
    expect(ownerTabId(world.state)).toBeNull();

    await world.settle();

    const elected = ownerTabId(world.state);
    expect(elected).toBe('t0');
    const owner = world.state.tabs.get('t0');
    if (owner === undefined) throw new Error('missing tab t0');
    expect(await readToyRows(owner.runtime.getClient())).toEqual(new Map());
  });
});
