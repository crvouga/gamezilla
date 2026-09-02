import { describe, expect, test } from 'bun:test';
import { openWorld, RELIABLE_NETWORK } from '@pkgs/dst';
import { check, runExamples } from '@pkgs/dst/pbt';
import { ownerTabId } from './ownership';
import { SQL_CLIENT_WEB_SYSTEM } from './system';
import { readToyRows } from './toy-kv';
import { boardOf } from './types';

const OPFS = { tabCount: 2, backend: 'web-sim-opfs' } as const;
const SYSTEM = SQL_CLIENT_WEB_SYSTEM as unknown as Parameters<typeof check>[0];

describe('sql-client web multi-tab system PBT', () => {
  test('check explores tabs, pool exhaustion, corruption, epochs', async () => {
    await check(SYSTEM, { episodeLength: 10, episodes: 4, vacuity: 'warn' });
  }, 180_000);

  test('named fault pins recover to a usable cache', async () => {
    await runExamples(
      SYSTEM,
      [
        {
          name: 'fill-pool-then-connect',
          inputs: {
            startTime: 0,
            knobs: OPFS,
            actions: [
              { kind: 'fillPool' },
              { kind: 'connect', tabId: 't0' },
              { kind: 'put', tabId: 't0', key: 'a', value: '1' },
              { kind: 'get', tabId: 't0', key: 'a' },
            ],
            networkFaults: RELIABLE_NETWORK,
          },
        },
        {
          name: 'corrupt-then-connect',
          inputs: {
            startTime: 0,
            knobs: OPFS,
            actions: [
              { kind: 'corruptStore' },
              { kind: 'connect', tabId: 't0' },
              { kind: 'put', tabId: 't0', key: 'a', value: '1' },
              { kind: 'get', tabId: 't0', key: 'a' },
            ],
            networkFaults: RELIABLE_NETWORK,
          },
        },
        {
          name: 'bump-epoch-clears-rows',
          inputs: {
            startTime: 0,
            knobs: OPFS,
            actions: [
              { kind: 'connect', tabId: 't0' },
              { kind: 'put', tabId: 't0', key: 'a', value: '1' },
              { kind: 'bumpEpoch' },
              { kind: 'killTab', tabId: 't0' },
              { kind: 'connect', tabId: 't0' },
              { kind: 'get', tabId: 't0', key: 'a' },
            ],
            networkFaults: RELIABLE_NETWORK,
          },
        },
        {
          name: 'kill-owner-promotes-peer',
          inputs: {
            startTime: 0,
            knobs: OPFS,
            actions: [
              { kind: 'connect', tabId: 't0' },
              { kind: 'connect', tabId: 't1' },
              { kind: 'put', tabId: 't0', key: 'a', value: '1' },
              { kind: 'killTab', tabId: 't0' },
              { kind: 'get', tabId: 't1', key: 'a' },
            ],
            networkFaults: RELIABLE_NETWORK,
          },
        },
      ],
      { seeds: [1, 2] }
    );
  }, 120_000);

  test('openWorld boots a store plus tabs and elects one owner', async () => {
    await using world = await openWorld(SQL_CLIENT_WEB_SYSTEM, {
      seed: 7,
      knobs: OPFS,
    });
    expect(world.nodeIds('tab')).toEqual(['t0', 't1']);
    expect(ownerTabId(boardOf(world))).toBeNull();

    await world.converge();

    const elected = ownerTabId(boardOf(world));
    expect(elected).toBe('t0');
    const owner = boardOf(world).tabs.get('t0');
    if (owner === undefined) throw new Error('missing tab t0');
    expect(await readToyRows(owner.runtime.getClient())).toEqual(new Map());
  });
});
