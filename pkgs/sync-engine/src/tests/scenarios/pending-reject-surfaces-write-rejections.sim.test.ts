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

describe('pending reject surfaces write rejections', () => {
  test('pending rejectable mutate uploads after reconnect, surfaces write_rejection, domain rolls back', async () => {
    // rowImageFanout off: rejected optimistic must not poison peers via images.
    await using s = await acmeSystem.script({
      seed: 711,
      args: { clientCount: 0, rowImageFanout: false },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');

    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'good' });
    await expectConverged(s);

    await s.apply(disconnect, 'alice');
    await s.apply(mutate, 'alice', serverRejectNote, {
      id: 'n1',
      body: 'bad-optimistic',
    });
    const mutationId = await s.observe(lastMutationId, 'alice');
    expect(mutationId).not.toBeNull();
    if (mutationId === null) return;
    await expectLiveNoteAt(s, 'alice', 'n1', { body: 'bad-optimistic' });

    await s.apply(connect, 'alice');
    await untilAcme(s, (s) => outcome(s, 'alice', mutationId));
    expect(await s.observe(outcome, 'alice', mutationId)).toBe('rejected');

    const unacked = await s.observe(rejections, 'alice');
    expect(unacked.length).toBe(1);
    expect(unacked[0]?.code).toBe('FORBIDDEN');
    expect(unacked[0]?.mutationId).toBe(mutationId);

    await s.apply(mutate, 'bob', setNote, { id: 'bump', body: 'x' });
    await expectConverged(s);
    await expectLiveNoteAt(s, 'alice', 'n1', { body: 'good' });
    await expectAllNotesAgree(s, ['alice', 'bob']);
  });
});
