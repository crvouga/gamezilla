import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  hold,
  httpFault,
  invariantViolations,
  mutate,
  release,
  setNote,
} from '../apps/acme';
import {
  expectLiveNoteAt,
  expectNoteNotLiveAt,
  liveNotes,
} from '../apps/acme/reads';

const IN_TXN_FAULT = { kind: 'failMutationsInsideTxnAfter', after: 0 } as const;

describe('replay txn rollback no pushseq leak', () => {
  test('in-txn fail rolls back; peer sees no push; retry applies once', async () => {
    await using s = await acmeSystem.script({
      seed: 910,
      args: { clientCount: 0, rowImageFanout: false },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');
    await s.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(s);

    // Hold peer sync so a successful retry cannot hydrate bob before we
    // observe the failed attempt's lack of live paint.
    await s.apply(hold, 'bob', 'sync');
    await s.apply(hold, 'bob', 'live');
    await s.apply(httpFault, 'alice', IN_TXN_FAULT);
    await s.apply(mutate, 'alice', setNote, {
      id: 'n-rollback',
      body: 'should-retry',
    });

    // First upload hits in-txn fault (rollback). Allow one retry window.
    await s.elapse(100);
    await expectNoteNotLiveAt(s, 'bob', 'n-rollback');

    await s.apply(release, 'bob', 'live');
    await s.apply(release, 'bob', 'sync');
    await expectConverged(s);
    await expectLiveNoteAt(s, 'bob', 'n-rollback', { body: 'should-retry' });
    await expectLiveNoteAt(s, 'server', 'n-rollback', {
      body: 'should-retry',
    });
    const serverNotes = await s.observe(liveNotes, 'server');
    expect(serverNotes.filter((n) => n.id === 'n-rollback').length).toBe(1);
    expect(await s.observe(invariantViolations)).toEqual([]);
  });

  test.each([911, 912, 913])(
    'seed sweep converges after in-txn fault (seed=%i)',
    async (seed) => {
      await using s = await acmeSystem.script({
        seed,
        args: { clientCount: 0 },
      });

      await s.apply(addClient, 'alice');
      await s.apply(addClient, 'bob');
      await s.apply(httpFault, 'alice', IN_TXN_FAULT);
      await s.apply(mutate, 'alice', setNote, {
        id: `n-${seed}`,
        body: `b-${seed}`,
      });
      await expectConverged(s);
      await expectLiveNoteAt(s, 'server', `n-${seed}`, {
        body: `b-${seed}`,
      });
    }
  );
});
