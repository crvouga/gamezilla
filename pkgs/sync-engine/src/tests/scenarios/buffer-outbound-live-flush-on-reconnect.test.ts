import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  connect,
  disconnect,
  expectConverged,
  expectNoteNotLiveAt,
  hold,
  liveNote,
  mutate,
  nodeNow,
  release,
  setNote,
  untilAcme,
} from '../apps/acme';

const PEER_VISIBLE_BUDGET_MS = 200;

describe('buffer outbound live flush on reconnect', () => {
  test('default: no outbound buffer; peers wait for upload/sync', async () => {
    await using s = await acmeSystem.script({
      seed: 701,
      args: {
        clientCount: 0,
      },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');
    await s.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(s);

    await s.apply(disconnect, 'alice');
    await s.apply(hold, 'alice', 'sync');
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'while-down' });
    await s.apply(connect, 'alice');
    await s.elapse(200);
    await expectNoteNotLiveAt(s, 'bob', 'n1');
    await s.apply(release, 'alice', 'sync');

    await expectConverged(s);
    expect(await s.observe(liveNote, 'bob', 'n1')).toMatchObject({
      body: 'while-down',
    });
  });

  test('bufferOutboundLive: peer sees note while publisher sync held', async () => {
    await using s = await acmeSystem.script({
      seed: 702,
      args: {
        clientCount: 0,
        bufferOutboundLive: true,
      },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');
    await s.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(s);

    await s.apply(disconnect, 'alice');
    await s.apply(hold, 'alice', 'sync');
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'buffered' });
    await s.apply(connect, 'alice');
    await s.elapse(200);
    expect(await s.observe(liveNote, 'bob', 'n1')).toMatchObject({
      body: 'buffered',
    });
    await s.apply(release, 'alice', 'sync');

    await expectConverged(s);
    expect(await s.observe(liveNote, 'bob', 'n1')).toMatchObject({
      body: 'buffered',
    });
  });

  test('bufferOutboundLive: peer visible under latency budget via live', async () => {
    await using s = await acmeSystem.script({
      seed: 703,
      args: {
        clientCount: 0,
        bufferOutboundLive: true,
      },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');
    await s.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(s);

    await s.apply(disconnect, 'alice');
    await s.apply(hold, 'bob', 'sync');
    await s.apply(mutate, 'alice', setNote, { id: 'fast', body: 'y' });
    const t0 = await s.observe(nodeNow, 'bob');
    await s.apply(connect, 'alice');
    await untilAcme(s, (s) => liveNote(s, 'bob', 'fast'), {
      pred: (v) => (v as { body?: string } | null)?.body === 'y',
      maxMs: 400,
      stepMs: 5,
    });
    const at = await s.observe(nodeNow, 'bob');
    expect(at - t0).toBeLessThan(PEER_VISIBLE_BUDGET_MS);
    await s.apply(release, 'bob', 'sync');

    await expectConverged(s);
  });
});
