import { describe, expect, test } from 'bun:test';
import {
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
  untilAcme,
} from '../apps/acme';

describe('args schema tightened server rejects stale args', () => {
  test.each([790, 791, 792])(
    'loose client args rejected by tight server (seed=%i)',
    async (seed) => {
      await using s = await acmeSystem.script({
        seed: seed,
        args: { clientCount: 0, rowImageFanout: false },
      });

      await s.apply(addClient, {
        id: 'alice',
        mutationRegistry: {
          ...acmeMutationRegistry,
          [setNoteArgsLoose.name]: setNoteArgsLoose,
        },
      });
      await s.apply(addClient, { id: 'bob' });

      // Seed an existing row so reject heals via snapshot (absence ≠ delete).
      await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'short' });
      await expectConverged(s);

      await s.apply(disconnect, 'alice');
      await s.apply(mutate, 'alice', setNoteArgsLoose, {
        id: 'n1',
        body: 'x'.repeat(64),
      });
      expect(await s.observe(lastMutationOk, 'alice')).toBe(true);
      const mutationId = await s.observe(lastMutationId, 'alice');
      expect(mutationId).not.toBeNull();
      if (mutationId === null) return;

      await s.apply(connect, 'alice');
      await untilAcme(s, (s) => outcome(s, 'alice', mutationId));
      expect(await s.observe(outcome, 'alice', mutationId)).toBe('rejected');

      const unacked = await s.observe(rejections, 'alice');
      expect(unacked.length).toBeGreaterThanOrEqual(1);
      expect(unacked.some((r) => r.mutationId === mutationId)).toBe(true);

      expect(await s.observe(liveNote, 'server', 'n1')).toMatchObject({
        body: 'short',
      });
      expect(await s.observe(liveNote, 'bob', 'n1')).toMatchObject({
        body: 'short',
      });

      // Bump server hash so alice's optimistic long body is overwritten.
      await s.apply(mutate, 'bob', setNote, { id: 'ok', body: 'healthy' });
      await expectConverged(s);
      expect(await s.observe(liveNote, 'alice', 'n1')).toMatchObject({
        body: 'short',
      });
      expect(await s.observe(liveNote, 'alice', 'ok')).toMatchObject({
        body: 'healthy',
      });
    }
  );
});
