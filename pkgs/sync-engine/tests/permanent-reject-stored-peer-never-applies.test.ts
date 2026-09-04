import { describe, expect, test } from 'bun:test';
import {
  acknowledgeWriteRejectionMutation,
  addClient,
  exampleSystem,
  expectInSync,
  lastMutationId,
  lastMutationOk,
  liveNote,
  mutate,
  outcome,
  rejections,
  serverRejectNote,
  setNote,
  untilExample,
} from '@pkgs/sync-engine/sim';

describe('permanent reject stored peer never applies', () => {
  test('server reject stores write_rejection and merge restores domain', async () => {
    // rowImageFanout off: rejected optimistic body must not poison peers.
    await using s = await exampleSystem.run({
      seed: 501,
      args: { clientCount: 0, rowImageFanout: false },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'good' });
    await expectInSync(s);

    await s.apply(mutate, 'alice', serverRejectNote, {
      id: 'n1',
      body: 'bad',
    });
    expect(await s.read(lastMutationOk, 'alice')).toBe(true);
    const rejectedId = await s.read(lastMutationId, 'alice');
    expect(rejectedId).not.toBeNull();
    if (rejectedId === null) return;

    await untilExample(s, (s) => outcome(s, 'alice', rejectedId));
    expect(await s.read(outcome, 'alice', rejectedId)).toBe('rejected');

    const unacked = await s.read(rejections, 'alice');
    expect(unacked.length).toBe(1);
    expect(unacked[0]?.code).toBe('FORBIDDEN');
    expect(unacked[0]?.mutationId).toBe(rejectedId);

    // Peer never applied the rejected body.
    expect(await s.read(liveNote, 'bob', 'n1')).toMatchObject({
      body: 'good',
    });

    // not_modified would leave alice's optimistic body; bump server hash.
    await s.apply(mutate, 'bob', setNote, { id: 'bump', body: 'x' });
    await expectInSync(s);
    expect(await s.read(liveNote, 'alice', 'n1')).toMatchObject({
      body: 'good',
    });

    const rejectionId = unacked[0]?.id;
    expect(rejectionId).toBeDefined();
    if (rejectionId === undefined) return;
    await s.apply(mutate, 'alice', acknowledgeWriteRejectionMutation, {
      rejectionId,
    });
    expect(await s.read(lastMutationOk, 'alice')).toBe(true);
    const ackId = await s.read(lastMutationId, 'alice');
    expect(ackId).not.toBeNull();
    if (ackId === null) return;
    await untilExample(s, (s) => outcome(s, 'alice', ackId));
    expect(await s.read(outcome, 'alice', ackId)).toBe('confirmed');
    expect(await s.read(rejections, 'alice')).toEqual([]);
  });
});
