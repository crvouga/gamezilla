import { describe, expect, test } from 'bun:test';
import { SYNC_PROTOCOL_VERSION } from '../../protocol';
import { expectLiveNote, isLiveNote, setNote } from '../apps/acme';
import { openAcmeWorld } from '../apps/acme/system';

describe('pending mutations across protocol cut drain', () => {
  test('offline queue drains under current protocol (preserve-and-drain)', async () => {
    expect(SYNC_PROTOCOL_VERSION).toBe(3);
    await using world = await openAcmeWorld({
      seed: 1210,
      knobs: {
        clientCount: 0,
      },
    });

    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.disconnect();
    await a.mutate(setNote, { id: 'pending-cut', body: 'queued-at-cut' });
    await world.waitNever(() => isLiveNote(world.server.db, 'pending-cut'), {
      forMs: 50,
    });

    // Reconnect speaks current protocol; stable mutation names drain unchanged.
    await a.connect();
    await world.assertConverged();
    await expectLiveNote(a.db, 'pending-cut', { body: 'queued-at-cut' });
    await expectLiveNote(b.db, 'pending-cut', { body: 'queued-at-cut' });
    await expectLiveNote(world.server.db, 'pending-cut', {
      body: 'queued-at-cut',
    });
  });
});
