import { describe, expect, test } from 'bun:test';
import { SYNC_PROTOCOL_VERSION } from '../../protocol';
import {
  acmeSystem,
  addClient,
  connect,
  disconnect,
  expectConverged,
  liveNote,
  mutate,
  neverAcme,
  noteLive,
  setNote,
} from '../apps/acme';

describe('pending mutations across protocol cut drain', () => {
  test('offline queue drains under current protocol (preserve-and-drain)', async () => {
    expect(SYNC_PROTOCOL_VERSION).toBe(3);
    await using s = await acmeSystem.script({
      seed: 1210,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    await s.apply(disconnect, 'alice');
    await s.apply(mutate, 'alice', setNote, {
      id: 'pending-cut',
      body: 'queued-at-cut',
    });
    await neverAcme(s, (s) => liveNote(s, 'server', 'pending-cut'), {
      forMs: 50,
      pred: noteLive,
    });

    // Reconnect speaks current protocol; stable mutation names drain unchanged.
    await s.apply(connect, 'alice');
    await expectConverged(s);
    expect(await s.observe(liveNote, 'alice', 'pending-cut')).toMatchObject({
      body: 'queued-at-cut',
    });
    expect(await s.observe(liveNote, 'bob', 'pending-cut')).toMatchObject({
      body: 'queued-at-cut',
    });
    expect(await s.observe(liveNote, 'server', 'pending-cut')).toMatchObject({
      body: 'queued-at-cut',
    });
  });
});
