import { describe, expect, test } from 'bun:test';
import type { AnyScenarioDef } from '@pkgs/determinism';
import { runScenario } from '@pkgs/determinism/pbt';
import { playSyncActions, replaySyncPin } from '../../sim/scenario';
import { setNote } from '../apps/acme';
import { acmeSetNoteOp } from '../apps/acme/domain-model';
import { acmeSystem, openAcmeWorld } from '../apps/acme/system';
import type { DomainOp, LibraryAction, SyncAction } from '../scenario/actions';

describe('fault permutation PBT', () => {
  test(
    'full fault pool interleaves and converges',
    async () => {
      await runScenario(acmeSystem as unknown as AnyScenarioDef, {
        maxCommands: 20,
        numRuns: 6,
      });
    },
    { timeout: 180_000 }
  );
});

function multiFaultSequence(
  arms: readonly LibraryAction[],
  trigger: DomainOp = acmeSetNoteOp('c0', 'n0', 'perm')
): SyncAction[] {
  return [...arms, trigger, { kind: 'idle', ms: 40 }, { kind: 'heal' }];
}

describe('fault permutation pins', () => {
  test('rate limit then mutate converges', async () => {
    await replaySyncPin(acmeSystem, {
      seed: 44001,
      commands: multiFaultSequence([
        {
          kind: 'armHttpFault',
          clientId: 'c0',
          fault: {
            kind: 'rateLimited',
            route: 'mutations',
            retryAfterMs: 5,
          },
        },
      ]),
    });
  });

  test('storage full then restart converges', async () => {
    await using world = await openAcmeWorld({ seed: 44002 });

    const c0 = world.clients.get('c0');
    expect(c0).toBeDefined();
    if (c0 === undefined) return;
    world.armStoragePressure('c0', 'sqliteFull');
    const denied = await c0.mutate(setNote, { id: 'n0', body: 'quota' });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.failures.some((f) => f.code === 'STORAGE_FULL')).toBe(true);
    }
    await playSyncActions(world, [
      { kind: 'restart', clientId: 'c0' },
      acmeSetNoteOp('c0', 'n0', 'after-restart'),
      { kind: 'heal' },
    ]);
    await world.assertConverged();
  });

  test('freeze sync then thaw catches up', async () => {
    await replaySyncPin(acmeSystem, {
      seed: 44003,
      commands: [
        { kind: 'freeze', clientId: 'c0' },
        acmeSetNoteOp('c0', 'n1', 'frozen'),
        { kind: 'thaw', clientId: 'c0' },
        { kind: 'idle', ms: 50 },
        { kind: 'heal' },
      ],
    });
  });

  test('auth expired in flight refreshes', async () => {
    await replaySyncPin(acmeSystem, {
      seed: 44004,
      commands: multiFaultSequence([
        {
          kind: 'armHttpFault',
          clientId: 'c0',
          fault: { kind: 'authExpiredInFlight', route: 'mutations' },
        },
      ]),
    });
  });
});
