import { describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import { exploreSync } from '../../sim/scenario';
import {
  acmeKnobs,
  acmeSystem,
  armStoragePressure,
  expectConverged,
  lastMutationFailures,
  lastMutationOk,
  mutate,
  playAcmePin,
  playActions,
  setNote,
  syncVirtualHost,
} from '../apps/acme';
import { acmeSetNoteOp } from '../apps/acme/domain-model';
import type { DomainOp, LibraryAction, SyncAction } from '../scenario/actions';

describe('fault permutation PBT', () => {
  test(
    'full fault pool interleaves and converges',
    async () => {
      await exploreSync(acmeSystem, {
        steps: 20,
        episodes: 6,
        seed: 44000,
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
    await using run = await script(acmeSystem, {
      seed: 44002,
      host: syncVirtualHost(),
      knobs: acmeKnobs(),
      properties: [],
    });

    await run.apply(armStoragePressure, 'c0', 'sqliteFull');
    await run.apply(mutate, 'c0', setNote, { id: 'n0', body: 'quota' });
    expect(await run.observe(lastMutationOk('c0'))).toBe(false);
    expect(await run.observe(lastMutationFailures('c0'))).toContain(
      'STORAGE_FULL'
    );

    await run.apply(playActions, [
      { kind: 'restart', clientId: 'c0' },
      acmeSetNoteOp('c0', 'n0', 'after-restart'),
      { kind: 'heal' },
    ]);
    await expectConverged(run);
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
