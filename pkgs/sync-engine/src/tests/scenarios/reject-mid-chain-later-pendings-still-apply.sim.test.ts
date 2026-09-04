import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  connect,
  disconnect,
  expectConverged,
  lastMutationId,
  mutate,
  outcome,
  rejections,
  serverRejectNote,
  setNote,
  untilAcme,
} from '../apps/acme';
import { expectAllNotesAgree, expectLiveNoteAt } from '../apps/acme/reads';

describe('reject mid chain later pendings still apply', () => {
  test('applied/rejected/applied batch: reject rolls back; later survive', async () => {
    await using s = await acmeSystem.script({
      seed: 824,
      args: { clientCount: 0, rowImageFanout: false },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');

    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'good' });
    await expectConverged(s);

    await s.apply(disconnect, 'alice');
    await s.apply(mutate, 'alice', setNote, { id: 'n2', body: 'before' });
    await s.apply(mutate, 'alice', serverRejectNote, {
      id: 'n1',
      body: 'bad-mid',
    });
    const badId = await s.observe(lastMutationId, 'alice');
    await s.apply(mutate, 'alice', setNote, { id: 'n3', body: 'after' });
    const okId = await s.observe(lastMutationId, 'alice');
    expect(badId).not.toBeNull();
    expect(okId).not.toBeNull();
    if (badId === null || okId === null) return;

    await s.apply(connect, 'alice');
    await untilAcme(s, (s) => outcome(s, 'alice', badId));
    await untilAcme(s, (s) => outcome(s, 'alice', okId));
    expect(await s.observe(outcome, 'alice', badId)).toBe('rejected');
    expect(await s.observe(outcome, 'alice', okId)).toBe('confirmed');

    const unacked = await s.observe(rejections, 'alice');
    expect(unacked.some((r) => r.mutationId === badId)).toBe(true);

    await s.apply(mutate, 'bob', setNote, { id: 'bump', body: 'x' });
    await expectConverged(s);

    await expectLiveNoteAt(s, 'alice', 'n1', { body: 'good' });
    await expectLiveNoteAt(s, 'bob', 'n2', { body: 'before' });
    await expectLiveNoteAt(s, 'bob', 'n3', { body: 'after' });
    await expectAllNotesAgree(s, ['alice', 'bob']);
  });
});
