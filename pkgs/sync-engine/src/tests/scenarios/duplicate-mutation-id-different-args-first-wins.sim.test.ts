import { describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  deviceId,
  expectConverged,
  expectLiveNoteAt,
  lastMutationId,
  lastMutationOk,
  mutate,
  nodeNow,
  postMutations,
  postOutcome,
  setNote,
  syncVirtualHost,
  untilAcme,
} from '../apps/acme';

describe('duplicate mutation id different args first wins', () => {
  test.each([830, 831, 832])(
    'hostile re-post same id keeps first body (seed=%i)',
    async (seed) => {
      await using run = await script(acmeSystem, {
        seed: seed,
        host: syncVirtualHost(),
        knobs: acmeKnobs({
          clientCount: 0,
        }),
        properties: [],
      });

      await run.apply(addClient, { id: 'alice' });
      await run.apply(addClient, { id: 'bob' });

      await run.apply(mutate, 'alice', setNote, {
        id: 'n1',
        body: 'first-wins',
      });
      expect(await run.observe(lastMutationOk('alice'))).toBe(true);
      const firstId = await run.observe(lastMutationId('alice'));
      expect(firstId).not.toBeNull();
      await expectConverged(run);

      await run.apply(postMutations, 'alice', [
        {
          id: firstId!,
          name: 'setNote',
          args: JSON.stringify({ id: 'n1', body: 'second-should-lose' }),
          clientId: (await run.observe(deviceId('alice')))!,
          seq: 999,
          createdAt: new Date(
            await run.observe(nodeNow('alice'))
          ).toISOString(),
        },
      ]);
      const hostile = await untilAcme(run, postOutcome('alice'));
      expect(hostile).toMatchObject({
        ok: true,
        verdicts: [{ status: 'applied' }],
      });

      await expectConverged(run);

      await expectLiveNoteAt(run, 'alice', 'n1', { body: 'first-wins' });
      await expectLiveNoteAt(run, 'bob', 'n1', { body: 'first-wins' });
      await expectLiveNoteAt(run, 'server', 'n1', { body: 'first-wins' });
    }
  );
});
