import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acknowledgeWriteRejectionMutation,
  acmeDraws,
  acmeSystem,
  addClient,
  expectConverged,
  lastMutationId,
  lastMutationOk,
  liveNote,
  mutate,
  outcome,
  rejections,
  serverRejectNote,
  setNote,
  syncVirtualHost,
  untilAcme,
} from '../apps/acme';

describe('permanent reject stored peer never applies', () => {
  test('server reject stores write_rejection and merge restores domain', async () => {
    // rowImageFanout off: rejected optimistic body must not poison peers.
    await using run = await start(acmeSystem, {
      seed: 501,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0, rowImageFanout: false }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });

    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'good' });
    await expectConverged(run);

    await run.apply(mutate, 'alice', serverRejectNote, {
      id: 'n1',
      body: 'bad',
    });
    expect(await run.observe(lastMutationOk('alice'))).toBe(true);
    const rejectedId = await run.observe(lastMutationId('alice'));
    expect(rejectedId).not.toBeNull();
    if (rejectedId === null) return;

    await untilAcme(run, outcome('alice', rejectedId));
    expect(await run.observe(outcome('alice', rejectedId))).toBe('rejected');

    const unacked = await run.observe(rejections('alice'));
    expect(unacked.length).toBe(1);
    expect(unacked[0]?.code).toBe('FORBIDDEN');
    expect(unacked[0]?.mutationId).toBe(rejectedId);

    // Peer never applied the rejected body.
    expect(await run.observe(liveNote('bob', 'n1'))).toMatchObject({
      body: 'good',
    });

    // not_modified would leave alice's optimistic body; bump server hash.
    await run.apply(mutate, 'bob', setNote, { id: 'bump', body: 'x' });
    await expectConverged(run);
    expect(await run.observe(liveNote('alice', 'n1'))).toMatchObject({
      body: 'good',
    });

    const rejectionId = unacked[0]?.id;
    expect(rejectionId).toBeDefined();
    if (rejectionId === undefined) return;
    await run.apply(mutate, 'alice', acknowledgeWriteRejectionMutation, {
      rejectionId,
    });
    expect(await run.observe(lastMutationOk('alice'))).toBe(true);
    const ackId = await run.observe(lastMutationId('alice'));
    expect(ackId).not.toBeNull();
    if (ackId === null) return;
    await untilAcme(run, outcome('alice', ackId));
    expect(await run.observe(outcome('alice', ackId))).toBe('confirmed');
    expect(await run.observe(rejections('alice'))).toEqual([]);
  });
});
