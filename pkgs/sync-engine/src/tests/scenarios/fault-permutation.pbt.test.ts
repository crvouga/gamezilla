import { describe, expect, test } from 'bun:test';
import { gen } from '@pkgs/dst/fast-check';
import { arbSyncArgs } from '../../sim/scenario';
import {
  acmeSystem,
  armStoragePressure,
  expectConverged,
  lastMutationFailures,
  lastMutationOk,
  mutate,
  playAcmePin,
  playActions,
  setNote,
} from '../apps/acme';
import { acmeSetNoteOp } from '../apps/acme/domain-model';
import type { DomainOp, LibraryAction, SyncAction } from '../scenario/actions';

describe('fault permutation PBT', () => {
  test(
    'full fault pool interleaves and converges',
    async () => {
      await acmeSystem.explore({
        args: gen(arbSyncArgs()),
        steps: 20,
        episodes: 6,
        seed: 44000,
        stopOnViolation: true,
        time: { weight: 1, minMs: 0, maxMs: 40 },
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
    await playAcmePin({
      seed: 44001,
      actions: multiFaultSequence([
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
    await using s = await acmeSystem.script({
      seed: 44002,
    });

    await s.apply(armStoragePressure, 'c0', 'sqliteFull');
    await s.apply(mutate, 'c0', setNote, { id: 'n0', body: 'quota' });
    expect(await s.observe(lastMutationOk, 'c0')).toBe(false);
    expect(await s.observe(lastMutationFailures, 'c0')).toContain(
      'STORAGE_FULL'
    );

    await s.apply(playActions, [
      { kind: 'restart', clientId: 'c0' },
      acmeSetNoteOp('c0', 'n0', 'after-restart'),
      { kind: 'heal' },
    ]);
    await expectConverged(s);
  });

  test('freeze sync then thaw catches up', async () => {
    await playAcmePin({
      seed: 44003,
      actions: [
        { kind: 'freeze', clientId: 'c0' },
        acmeSetNoteOp('c0', 'n1', 'frozen'),
        { kind: 'thaw', clientId: 'c0' },
        { kind: 'idle', ms: 50 },
        { kind: 'heal' },
      ],
    });
  });

  test('auth expired in flight refreshes', async () => {
    await playAcmePin({
      seed: 44004,
      actions: multiFaultSequence([
        {
          kind: 'armHttpFault',
          clientId: 'c0',
          fault: { kind: 'authExpiredInFlight', route: 'mutations' },
        },
      ]),
    });
  });
});
