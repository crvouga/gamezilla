import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeMutationRegistry,
  acmeSystem,
  addClient,
  connect,
  disconnect,
  expectConverged,
  lastMutationId,
  lastMutationOk,
  liveNote,
  mutate,
  outcome,
  rejections,
  setNote,
  setNoteArgsLoose,
  syncVirtualHost,
  untilAcme,
} from '../apps/acme';

describe('args schema tightened server rejects stale args', () => {
  test.each([790, 791, 792])(
    'loose client args rejected by tight server (seed=%i)',
    async (seed) => {
      await using run = await start(acmeSystem, {
        seed: seed,
        host: syncVirtualHost(),
        draws: acmeDraws({ clientCount: 0, rowImageFanout: false }),
        properties: [],
      });

      await run.apply(addClient, {
        id: 'alice',
        mutationRegistry: {
          ...acmeMutationRegistry,
          [setNoteArgsLoose.name]: setNoteArgsLoose,
        },
      });
      await run.apply(addClient, { id: 'bob' });

      // Seed an existing row so reject heals via snapshot (absence ≠ delete).
      await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'short' });
      await expectConverged(run);

      await run.apply(disconnect, 'alice');
      await run.apply(mutate, 'alice', setNoteArgsLoose, {
        id: 'n1',
        body: 'x'.repeat(64),
      });
      expect(await run.observe(lastMutationOk('alice'))).toBe(true);
      const mutationId = await run.observe(lastMutationId('alice'));
      expect(mutationId).not.toBeNull();
      if (mutationId === null) return;

      await run.apply(connect, 'alice');
      await untilAcme(run, outcome('alice', mutationId));
      expect(await run.observe(outcome('alice', mutationId))).toBe('rejected');

      const unacked = await run.observe(rejections('alice'));
      expect(unacked.length).toBeGreaterThanOrEqual(1);
      expect(unacked.some((r) => r.mutationId === mutationId)).toBe(true);

      expect(await run.observe(liveNote('server', 'n1'))).toMatchObject({
        body: 'short',
      });
      expect(await run.observe(liveNote('bob', 'n1'))).toMatchObject({
        body: 'short',
      });

      // Bump server hash so alice's optimistic long body is overwritten.
      await run.apply(mutate, 'bob', setNote, { id: 'ok', body: 'healthy' });
      await expectConverged(run);
      expect(await run.observe(liveNote('alice', 'n1'))).toMatchObject({
        body: 'short',
      });
      expect(await run.observe(liveNote('alice', 'ok'))).toMatchObject({
        body: 'healthy',
      });
    }
  );
});
