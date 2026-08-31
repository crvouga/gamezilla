import { describe, test } from 'bun:test';
import { assertDstProperty, fc } from '@pkgs/pbt';
import { openWorld } from '../../sim/world';
import { acmeSetNoteOp } from '../apps/acme/domain-model';
import { acmeDstApp } from '../apps/acme/dst-app';
import type { DomainOp, DstAction, LibraryAction } from '../dst/actions';
import { worldPropertyInputs } from '../dst/commands';

describe('fault permutation PBT', () => {
  test(
    'full fault pool interleaves and converges',
    async () => {
      await assertDstProperty(
        'fault permutation converges',
        fc.asyncProperty(
          worldPropertyInputs(acmeDstApp, 20),
          async ([seed, knobs, cmds]) => {
            await using world = await openWorld({
              app: acmeDstApp,
              seed,
              knobs,
            });
            await world.runCommands(cmds);
          }
        ),
        { numRuns: 6 }
      );
    },
    { timeout: 180_000 }
  );
});

function multiFaultSequence(
  arms: readonly LibraryAction[],
  trigger: DomainOp = acmeSetNoteOp('c0', 'n0', 'perm')
): DstAction[] {
  return [...arms, trigger, { kind: 'idle', ms: 40 }, { kind: 'heal' }];
}

describe('fault permutation pins', () => {
  test('rate limit then mutate converges', async () => {
    await using world = await openWorld({ app: acmeDstApp, seed: 44001 });
    await world.playActions(
      multiFaultSequence([
        {
          kind: 'armHttpFault',
          clientId: 'c0',
          fault: {
            kind: 'rateLimited',
            route: 'mutations',
            retryAfterMs: 5,
          },
        },
      ])
    );
    await world.assertConverged();
  });

  test('storage full then restart converges', async () => {
    await using world = await openWorld({ app: acmeDstApp, seed: 44002 });
    await world.playActions([
      {
        kind: 'armStoragePressure',
        clientId: 'c0',
        pressure: 'sqliteFull',
      },
    ]);
    try {
      await world.playActions([acmeSetNoteOp('c0', 'n0', 'quota')]);
    } catch {
      // local mutate aborts under quota; queue must survive restart
    }
    await world.playActions([
      { kind: 'restart', clientId: 'c0' },
      acmeSetNoteOp('c0', 'n0', 'after-restart'),
      { kind: 'heal' },
    ]);
    await world.assertConverged();
  });

  test('freeze sync then thaw catches up', async () => {
    await using world = await openWorld({ app: acmeDstApp, seed: 44003 });
    await world.playActions([
      { kind: 'freeze', clientId: 'c0' },
      acmeSetNoteOp('c0', 'n1', 'frozen'),
      { kind: 'thaw', clientId: 'c0' },
      { kind: 'idle', ms: 50 },
      { kind: 'heal' },
    ]);
    await world.assertConverged();
  });

  test('auth expired in flight refreshes', async () => {
    await using world = await openWorld({ app: acmeDstApp, seed: 44004 });
    await world.playActions(
      multiFaultSequence([
        {
          kind: 'armHttpFault',
          clientId: 'c0',
          fault: { kind: 'authExpiredInFlight', route: 'mutations' },
        },
      ])
    );
    await world.assertConverged();
  });
});
