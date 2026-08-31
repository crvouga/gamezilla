import { describe, expect, test } from 'bun:test';
import { openWorld } from '../../sim/world';
import { acmeDomainPack, expectLiveNote, setNote } from '../apps/acme';

describe('late retry after prune window idempotent', () => {
  test.each([860, 861, 862])(
    're-POST after prune is duplicate and does not double-apply (seed=%i)',
    async (seed) => {
      await using world = await openWorld({
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

      await world.server.pruneArtifacts(-2_000_000_000_000);

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
      // Wire ack is `applied` for idempotent retries (duplicate replay path).
      expect(late.verdicts[0]?.status).toBe('applied');

      await world.until(a.nudge());
      await world.assertConverged();

      await expectLiveNote(world.server.db, 'n1', { body: 'original' });
    }
  );
});
