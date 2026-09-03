import { describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  expectConverged,
  hold,
  httpFault,
  invariantViolations,
  mutate,
  passTime,
  release,
  setNote,
  syncVirtualHost,
} from '../apps/acme';
import {
  expectLiveNoteAt,
  expectNoteNotLiveAt,
  liveNotes,
} from '../apps/acme/reads';

const IN_TXN_FAULT = { kind: 'failMutationsInsideTxnAfter', after: 0 } as const;

describe('replay txn rollback no pushseq leak', () => {
  test('in-txn fail rolls back; peer sees no push; retry applies once', async () => {
    await using run = await script(acmeSystem, {
      seed: 910,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0, rowImageFanout: false }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');
    await run.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(run);

    // Hold peer sync so a successful retry cannot hydrate bob before we
    // observe the failed attempt's lack of live paint.
    await run.apply(hold, 'bob', 'sync');
    await run.apply(hold, 'bob', 'live');
    await run.apply(httpFault, 'alice', IN_TXN_FAULT);
    await run.apply(mutate, 'alice', setNote, {
      id: 'n-rollback',
      body: 'should-retry',
    });

    // First upload hits in-txn fault (rollback). Allow one retry window.
    await run.apply(passTime, 100);
    await expectNoteNotLiveAt(run, 'bob', 'n-rollback');

    await run.apply(release, 'bob', 'live');
    await run.apply(release, 'bob', 'sync');
    await expectConverged(run);
    await expectLiveNoteAt(run, 'bob', 'n-rollback', { body: 'should-retry' });
    await expectLiveNoteAt(run, 'server', 'n-rollback', {
      body: 'should-retry',
    });
    const serverNotes = await run.observe(liveNotes('server'));
    expect(serverNotes.filter((n) => n.id === 'n-rollback').length).toBe(1);
    expect(await run.observe(invariantViolations)).toEqual([]);
  });

  test.each([911, 912, 913])(
    'seed sweep converges after in-txn fault (seed=%i)',
    async (seed) => {
      await using run = await script(acmeSystem, {
        seed,
        host: syncVirtualHost(),
        knobs: acmeKnobs({ clientCount: 0 }),
        properties: [],
      });

      await run.apply(addClient, 'alice');
      await run.apply(addClient, 'bob');
      await run.apply(httpFault, 'alice', IN_TXN_FAULT);
      await run.apply(mutate, 'alice', setNote, {
        id: `n-${seed}`,
        body: `b-${seed}`,
      });
      await expectConverged(run);
      await expectLiveNoteAt(run, 'server', `n-${seed}`, {
        body: `b-${seed}`,
      });
    }
  );
});
