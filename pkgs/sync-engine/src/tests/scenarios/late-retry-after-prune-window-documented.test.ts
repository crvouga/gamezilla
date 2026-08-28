import { describe, expect, test } from 'bun:test';
import { openSimWorld } from '../../sim/world';
import { acmeDomainPack, expectLiveNote, setNote } from '../apps/acme';

describe('late retry after prune window documented', () => {
  test.each([860, 861, 862])(
    're-POST after prune double-applies (seed=%i)',
    async (seed) => {
      // Known limitation: pruning idempotency rows lets a late retry with the
      // same mutation id apply again (setNote upsert → last write wins).
      // Retention jobs must keep the window longer than max client retry life.
      await using world = await openSimWorld({
        domain: acmeDomainPack,
        seed,
      });
      const a = await world.addClient({ id: 'alice' });
      await world.addClient({ id: 'bob' });

      const first = await a.mutate(setNote, { id: 'n1', body: 'original' });
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      await world.assertConverged();
      await expectLiveNote(world.server.db, 'n1', { body: 'original' });

      // Sim applied_at uses wall-clock SQLite datetime; sim now is 2023.
      // Negative olderThanMs pushes cutoff into the future (keep it in the
      // 4-digit year range so ISO string compares cleanly with SQLite text).
      await world.server.pruneArtifacts(-2_000_000_000_000);

      // Direct server handler — same idempotency path as HTTP POST /mutations.
      world.server.setAuth({
        actorId: a.actorId,
        deviceId: a.deviceId,
        accountId: `acct:${a.actorId}`,
        isAnon: false,
      });
      const late = await world.server.handlers.handleMutations([
        {
          id: first.mutationId,
          name: 'setNote',
          args: JSON.stringify({ id: 'n1', body: 'after-prune' }),
          clientId: a.deviceId,
          seq: 1,
          createdAt: new Date(world.node('alice').now()).toISOString(),
        },
      ]);
      expect(late.ok).toBe(true);
      expect(late.verdicts[0]?.status).toBe('applied');

      // nudge: client must refetch server state after late double-apply
      await world.until(a.nudge());
      await world.assertConverged();

      // Pinned: prune + late retry with different args double-applies.
      await expectLiveNote(world.server.db, 'n1', { body: 'after-prune' });
    }
  );
});
