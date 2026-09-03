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
  nudge,
  postOutcome,
  serverPrune,
  serverReplay,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

/** Prune everything: any artifact is older than this (negative) cutoff. */
const PRUNE_ALL_MS = -2_000_000_000_000;

describe('late retry after prune window idempotent', () => {
  test.each([860, 861, 862])(
    're-POST after prune is duplicate and does not double-apply (seed=%i)',
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

      await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'original' });
      expect(await run.observe(lastMutationOk, 'alice')).toBe(true);
      const firstId = await run.observe(lastMutationId, 'alice');
      expect(firstId).not.toBeNull();
      await expectConverged(run);
      await expectLiveNoteAt(run, 'server', 'n1', { body: 'original' });

      await run.apply(serverPrune, PRUNE_ALL_MS);

      await run.apply(serverReplay, 'alice', [
        {
          id: firstId!,
          name: 'setNote',
          args: JSON.stringify({ id: 'n1', body: 'after-prune' }),
          clientId: (await run.observe(deviceId, 'alice'))!,
          seq: 1,
          createdAt: new Date(
            await run.observe(nodeNow, 'alice')
          ).toISOString(),
        },
      ]);
      // Wire ack is `applied` for idempotent retries (duplicate replay path).
      expect(await run.observe(postOutcome, 'alice')).toMatchObject({
        ok: true,
        verdicts: [{ status: 'applied' }],
      });

      await run.apply(nudge, 'alice');
      await expectConverged(run);

      await expectLiveNoteAt(run, 'server', 'n1', { body: 'original' });
    }
  );
});
