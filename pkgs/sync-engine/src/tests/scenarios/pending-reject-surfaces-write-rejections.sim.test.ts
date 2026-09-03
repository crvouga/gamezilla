import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeKnobs,
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
  syncVirtualHost,
  untilAcme,
} from '../apps/acme';
import { expectAllNotesAgree, expectLiveNoteAt } from '../apps/acme/reads';

describe('pending reject surfaces write rejections', () => {
  test('pending rejectable mutate uploads after reconnect, surfaces write_rejection, domain rolls back', async () => {
    // rowImageFanout off: rejected optimistic must not poison peers via images.
    await using run = await start(acmeSystem, {
      seed: 711,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0, rowImageFanout: false }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');

    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'good' });
    await expectConverged(run);

    await run.apply(disconnect, 'alice');
    await run.apply(mutate, 'alice', serverRejectNote, {
      id: 'n1',
      body: 'bad-optimistic',
    });
    const mutationId = await run.observe(lastMutationId('alice'));
    expect(mutationId).not.toBeNull();
    if (mutationId === null) return;
    await expectLiveNoteAt(run, 'alice', 'n1', { body: 'bad-optimistic' });

    await run.apply(connect, 'alice');
    await untilAcme(run, outcome('alice', mutationId));
    expect(await run.observe(outcome('alice', mutationId))).toBe('rejected');

    const unacked = await run.observe(rejections('alice'));
    expect(unacked.length).toBe(1);
    expect(unacked[0]?.code).toBe('FORBIDDEN');
    expect(unacked[0]?.mutationId).toBe(mutationId);

    await run.apply(mutate, 'bob', setNote, { id: 'bump', body: 'x' });
    await expectConverged(run);
    await expectLiveNoteAt(run, 'alice', 'n1', { body: 'good' });
    await expectAllNotesAgree(run, ['alice', 'bob']);
  });
});
