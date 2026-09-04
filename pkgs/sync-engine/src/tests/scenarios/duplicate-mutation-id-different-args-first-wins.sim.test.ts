import { describe, expect, test } from 'bun:test';
import {
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
  untilAcme,
} from '../apps/acme';

describe('duplicate mutation id different args first wins', () => {
  test.each([830, 831, 832])(
    'hostile re-post same id keeps first body (seed=%i)',
    async (seed) => {
      await using s = await acmeSystem.script({
        seed: seed,
        args: {
          clientCount: 0,
        },
      });

      await s.apply(addClient, { id: 'alice' });
      await s.apply(addClient, { id: 'bob' });

      await s.apply(mutate, 'alice', setNote, {
        id: 'n1',
        body: 'first-wins',
      });
      expect(await s.observe(lastMutationOk, 'alice')).toBe(true);
      const firstId = await s.observe(lastMutationId, 'alice');
      expect(firstId).not.toBeNull();
      await expectConverged(s);

      await s.apply(postMutations, 'alice', [
        {
          id: firstId!,
          name: 'setNote',
          args: JSON.stringify({ id: 'n1', body: 'second-should-lose' }),
          clientId: (await s.observe(deviceId, 'alice'))!,
          seq: 999,
          createdAt: new Date(await s.observe(nodeNow, 'alice')).toISOString(),
        },
      ]);
      const hostile = await untilAcme(s, (s) => postOutcome(s, 'alice'));
      expect(hostile).toMatchObject({
        ok: true,
        verdicts: [{ status: 'applied' }],
      });

      await expectConverged(s);

      await expectLiveNoteAt(s, 'alice', 'n1', { body: 'first-wins' });
      await expectLiveNoteAt(s, 'bob', 'n1', { body: 'first-wins' });
      await expectLiveNoteAt(s, 'server', 'n1', { body: 'first-wins' });
    }
  );
});
