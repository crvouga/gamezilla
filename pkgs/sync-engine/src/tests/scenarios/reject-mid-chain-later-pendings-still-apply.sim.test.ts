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

describe('reject mid chain later pendings still apply', () => {
  test('applied/rejected/applied batch: reject rolls back; later survive', async () => {
    await using run = await start(acmeSystem, {
      seed: 824,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0, rowImageFanout: false }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');

    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'good' });
    await expectConverged(run);

    await run.apply(disconnect, 'alice');
    await run.apply(mutate, 'alice', setNote, { id: 'n2', body: 'before' });
    await run.apply(mutate, 'alice', serverRejectNote, {
      id: 'n1',
      body: 'bad-mid',
    });
    const badId = await run.observe(lastMutationId('alice'));
    await run.apply(mutate, 'alice', setNote, { id: 'n3', body: 'after' });
    const okId = await run.observe(lastMutationId('alice'));
    expect(badId).not.toBeNull();
    expect(okId).not.toBeNull();
    if (badId === null || okId === null) return;

    await run.apply(connect, 'alice');
    await untilAcme(run, outcome('alice', badId));
    await untilAcme(run, outcome('alice', okId));
    expect(await run.observe(outcome('alice', badId))).toBe('rejected');
    expect(await run.observe(outcome('alice', okId))).toBe('confirmed');

    const unacked = await run.observe(rejections('alice'));
    expect(unacked.some((r) => r.mutationId === badId)).toBe(true);

    await run.apply(mutate, 'bob', setNote, { id: 'bump', body: 'x' });
    await expectConverged(run);

    await expectLiveNoteAt(run, 'alice', 'n1', { body: 'good' });
    await expectLiveNoteAt(run, 'bob', 'n2', { body: 'before' });
    await expectLiveNoteAt(run, 'bob', 'n3', { body: 'after' });
    await expectAllNotesAgree(run, ['alice', 'bob']);
  });
});
