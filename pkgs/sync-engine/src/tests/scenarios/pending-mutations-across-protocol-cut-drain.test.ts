import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  isLiveNote,
  notesDomainPack,
  setNote,
} from '../../domain-packs/notes-app';
import { SYNC_PROTOCOL_VERSION } from '../../protocol';
import { openSimWorld } from '../../sim/world';

describe('pending mutations across protocol cut drain', () => {
  test('offline queue drains under protocol v2 (preserve-and-drain)', async () => {
    expect(SYNC_PROTOCOL_VERSION).toBe(2);
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 1210,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.disconnect();
    await a.mutate(setNote, { id: 'pending-cut', body: 'queued-at-cut' });
    await world.never(() => isLiveNote(world.server.db, 'pending-cut'), {
      forMs: 50,
    });

    // Reconnect speaks protocol v2; stable mutation names drain unchanged.
    await a.connect();
    await world.assertConverged();
    await expectLiveNote(a.db, 'pending-cut', { body: 'queued-at-cut' });
    await expectLiveNote(b.db, 'pending-cut', { body: 'queued-at-cut' });
    await expectLiveNote(world.server.db, 'pending-cut', {
      body: 'queued-at-cut',
    });
  });
});
