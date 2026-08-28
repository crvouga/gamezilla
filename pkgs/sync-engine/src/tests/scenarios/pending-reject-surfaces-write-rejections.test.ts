import { describe, expect, test } from 'bun:test';
import { openSimWorld } from '../../sim/world';
import {
  acmeDomainPack,
  expectLiveNote,
  expectNotesMatchServer,
  serverRejectNote,
  setNote,
} from '../apps/acme';

describe('pending reject surfaces write rejections', () => {
  test('pending rejectable mutate uploads after reconnect, surfaces write_rejection, domain rolls back', async () => {
    // rowImageFanout off: rejected optimistic must not poison peers via images.
    await using world = await openSimWorld({
      domain: acmeDomainPack,
      seed: 711,
      rowImageFanout: false,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'n1', body: 'good' });
    await world.assertConverged();

    await a.disconnect();
    const rejected = await a.mutate(serverRejectNote, {
      id: 'n1',
      body: 'bad-optimistic',
    });
    expect(rejected.ok).toBe(true);
    if (!rejected.ok) return;
    await expectLiveNote(a.db, 'n1', { body: 'bad-optimistic' });

    await a.connect();
    await world.until(a.outcome(rejected.mutationId));
    expect(await a.outcome(rejected.mutationId)).toBe('rejected');

    const unacked = await a.rejections();
    expect(unacked.length).toBe(1);
    expect(unacked[0]?.code).toBe('FORBIDDEN');
    expect(unacked[0]?.mutationId).toBe(rejected.mutationId);

    await b.mutate(setNote, { id: 'bump', body: 'x' });
    await world.assertConverged();
    await expectLiveNote(a.db, 'n1', { body: 'good' });
    await expectNotesMatchServer(a.db, world.server.db);
    await expectNotesMatchServer(b.db, world.server.db);
  });
});
