import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import { SYNC_PROTOCOL_VERSION } from '../../protocol';
import {
  acmeKnobs,
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
  syncVirtualHost,
} from '../apps/acme';

describe('pending mutations across protocol cut drain', () => {
  test('offline queue drains under current protocol (preserve-and-drain)', async () => {
    expect(SYNC_PROTOCOL_VERSION).toBe(3);
    await using run = await start(acmeSystem, {
      seed: 1210,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });

    await run.apply(disconnect, 'alice');
    await run.apply(mutate, 'alice', setNote, {
      id: 'pending-cut',
      body: 'queued-at-cut',
    });
    await neverAcme(run, liveNote('server', 'pending-cut'), {
      forMs: 50,
      pred: noteLive,
    });

    // Reconnect speaks current protocol; stable mutation names drain unchanged.
    await run.apply(connect, 'alice');
    await expectConverged(run);
    expect(await run.observe(liveNote('alice', 'pending-cut'))).toMatchObject({
      body: 'queued-at-cut',
    });
    expect(await run.observe(liveNote('bob', 'pending-cut'))).toMatchObject({
      body: 'queued-at-cut',
    });
    expect(await run.observe(liveNote('server', 'pending-cut'))).toMatchObject({
      body: 'queued-at-cut',
    });
  });
});
