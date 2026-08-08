import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  expectNotesMatchServer,
  notesDomainPack,
  serverRejectNote,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

describe('reject mid chain later pendings still apply', () => {
  test('applied/rejected/applied batch: reject rolls back; later survive', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 824,
      faults: RELIABLE_FAULTS,
      rowImageFanout: false,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'n1', body: 'good' });
    await world.assertConverged();

    await a.disconnect();
    const ok1 = await a.mutate(setNote, { id: 'n2', body: 'before' });
    const bad = await a.mutate(serverRejectNote, {
      id: 'n1',
      body: 'bad-mid',
    });
    const ok2 = await a.mutate(setNote, { id: 'n3', body: 'after' });
    expect(ok1.ok && bad.ok && ok2.ok).toBe(true);
    if (!ok1.ok || !bad.ok || !ok2.ok) return;

    await a.connect();
    await world.until(a.outcome(bad.mutationId));
    await world.until(a.outcome(ok2.mutationId));
    expect(await a.outcome(bad.mutationId)).toBe('rejected');
    expect(await a.outcome(ok2.mutationId)).toBe('confirmed');

    const unacked = await a.rejections();
    expect(unacked.some((r) => r.mutationId === bad.mutationId)).toBe(true);

    await b.mutate(setNote, { id: 'bump', body: 'x' });
    await world.assertConverged();

    await expectLiveNote(a.db, 'n1', { body: 'good' });
    await expectLiveNote(b.db, 'n2', { body: 'before' });
    await expectLiveNote(b.db, 'n3', { body: 'after' });
    await expectNotesMatchServer(a.db, world.server.db);
    await expectNotesMatchServer(b.db, world.server.db);
  });
});
