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
  nudge,
  postOutcome,
  serverPrune,
  serverReplay,
  setNote,
} from '../apps/acme';

/** Prune everything: any artifact is older than this (negative) cutoff. */
const PRUNE_ALL_MS = -2_000_000_000_000;

describe('late retry after prune window idempotent', () => {
  test.each([860, 861, 862])(
    're-POST after prune is duplicate and does not double-apply (seed=%i)',
    async (seed) => {
      await using s = await acmeSystem.script({
        seed: seed,
        args: {
          clientCount: 0,
        },
      });

      await s.apply(addClient, { id: 'alice' });
      await s.apply(addClient, { id: 'bob' });

      await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'original' });
      expect(await s.observe(lastMutationOk, 'alice')).toBe(true);
      const firstId = await s.observe(lastMutationId, 'alice');
      expect(firstId).not.toBeNull();
      await expectConverged(s);
      await expectLiveNoteAt(s, 'server', 'n1', { body: 'original' });

      await s.apply(serverPrune, PRUNE_ALL_MS);

      await s.apply(serverReplay, 'alice', [
        {
          id: firstId!,
          name: 'setNote',
          args: JSON.stringify({ id: 'n1', body: 'after-prune' }),
          clientId: (await s.observe(deviceId, 'alice'))!,
          seq: 1,
          createdAt: new Date(await s.observe(nodeNow, 'alice')).toISOString(),
        },
      ]);
      // Wire ack is `applied` for idempotent retries (duplicate replay path).
      expect(await s.observe(postOutcome, 'alice')).toMatchObject({
        ok: true,
        verdicts: [{ status: 'applied' }],
      });

      await s.apply(nudge, 'alice');
      await expectConverged(s);

      await expectLiveNoteAt(s, 'server', 'n1', { body: 'original' });
    }
  );
});
