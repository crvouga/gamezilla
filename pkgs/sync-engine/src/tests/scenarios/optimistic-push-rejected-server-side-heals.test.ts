import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  hold,
  lastMutationId,
  mutate,
  outcome,
  rejections,
  release,
  serverRejectNote,
  setNote,
  untilAcme,
} from '../apps/acme';
import { expectAllNotesAgree, expectLiveNoteAt } from '../apps/acme/reads';

describe('optimistic push rejected server side heals', () => {
  test('optimistic live paint on peer heals to server truth after reject', async () => {
    await using s = await acmeSystem.script({
      seed: 810,
      args: { clientCount: 0, bufferOutboundLive: true },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');

    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'good' });
    await expectConverged(s);

    // Hold mutator sync so upload cannot ack; peer may still see optimistic.
    await s.apply(hold, 'alice', 'sync');
    await s.apply(hold, 'bob', 'sync');
    await s.apply(mutate, 'alice', serverRejectNote, {
      id: 'n1',
      body: 'bad-optimistic',
    });
    const mutationId = await s.observe(lastMutationId, 'alice');
    expect(mutationId).not.toBeNull();
    if (mutationId === null) return;

    await s.elapse(300);
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'bad-optimistic' });

    await s.apply(release, 'alice', 'sync');
    await untilAcme(s, (s) => outcome(s, 'alice', mutationId));
    expect((await s.observe(rejections, 'alice')).length).toBe(1);

    await s.apply(release, 'bob', 'sync');
    await s.apply(mutate, 'bob', setNote, { id: 'bump', body: 'x' });
    await expectConverged(s);

    await expectLiveNoteAt(s, 'alice', 'n1', { body: 'good' });
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'good' });
    await expectAllNotesAgree(s, ['alice', 'bob']);
  });
});
