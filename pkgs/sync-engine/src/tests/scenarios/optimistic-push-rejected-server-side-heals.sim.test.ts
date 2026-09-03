import { describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  expectConverged,
  hold,
  lastMutationId,
  mutate,
  outcome,
  passTime,
  rejections,
  release,
  serverRejectNote,
  setNote,
  syncVirtualHost,
  untilAcme,
} from '../apps/acme';
import { expectAllNotesAgree, expectLiveNoteAt } from '../apps/acme/reads';

describe('optimistic push rejected server side heals', () => {
  test('optimistic live paint on peer heals to server truth after reject', async () => {
    await using run = await script(acmeSystem, {
      seed: 810,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0, bufferOutboundLive: true }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');

    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'good' });
    await expectConverged(run);

    // Hold mutator sync so upload cannot ack; peer may still see optimistic.
    await run.apply(hold, 'alice', 'sync');
    await run.apply(hold, 'bob', 'sync');
    await run.apply(mutate, 'alice', serverRejectNote, {
      id: 'n1',
      body: 'bad-optimistic',
    });
    const mutationId = await run.observe(lastMutationId('alice'));
    expect(mutationId).not.toBeNull();
    if (mutationId === null) return;

    await run.apply(passTime, 300);
    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'bad-optimistic' });

    await run.apply(release, 'alice', 'sync');
    await untilAcme(run, outcome('alice', mutationId));
    expect((await run.observe(rejections('alice'))).length).toBe(1);

    await run.apply(release, 'bob', 'sync');
    await run.apply(mutate, 'bob', setNote, { id: 'bump', body: 'x' });
    await expectConverged(run);

    await expectLiveNoteAt(run, 'alice', 'n1', { body: 'good' });
    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'good' });
    await expectAllNotesAgree(run, ['alice', 'bob']);
  });
});
