import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeKnobs,
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
  passTime,
  release,
  setNote,
  syncVirtualHost,
  untilAcme,
} from '../apps/acme';

const PEER_VISIBLE_BUDGET_MS = 200;

describe('buffer outbound live flush on reconnect', () => {
  test('default: no outbound buffer; peers wait for upload/sync', async () => {
    await using run = await start(acmeSystem, {
      seed: 701,
      host: syncVirtualHost(),
      knobs: acmeKnobs({
        clientCount: 0,
      }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');
    await run.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(run);

    await run.apply(disconnect, 'alice');
    await run.apply(hold, 'alice', 'sync');
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'while-down' });
    await run.apply(connect, 'alice');
    await run.apply(passTime, 200);
    await expectNoteNotLiveAt(run, 'bob', 'n1');
    await run.apply(release, 'alice', 'sync');

    await expectConverged(run);
    expect(await run.observe(liveNote('bob', 'n1'))).toMatchObject({
      body: 'while-down',
    });
  });

  test('bufferOutboundLive: peer sees note while publisher sync held', async () => {
    await using run = await start(acmeSystem, {
      seed: 702,
      host: syncVirtualHost(),
      knobs: acmeKnobs({
        clientCount: 0,
        bufferOutboundLive: true,
      }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');
    await run.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(run);

    await run.apply(disconnect, 'alice');
    await run.apply(hold, 'alice', 'sync');
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'buffered' });
    await run.apply(connect, 'alice');
    await run.apply(passTime, 200);
    expect(await run.observe(liveNote('bob', 'n1'))).toMatchObject({
      body: 'buffered',
    });
    await run.apply(release, 'alice', 'sync');

    await expectConverged(run);
    expect(await run.observe(liveNote('bob', 'n1'))).toMatchObject({
      body: 'buffered',
    });
  });

  test('bufferOutboundLive: peer visible under latency budget via live', async () => {
    await using run = await start(acmeSystem, {
      seed: 703,
      host: syncVirtualHost(),
      knobs: acmeKnobs({
        clientCount: 0,
        bufferOutboundLive: true,
      }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');
    await run.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(run);

    await run.apply(disconnect, 'alice');
    await run.apply(hold, 'bob', 'sync');
    await run.apply(mutate, 'alice', setNote, { id: 'fast', body: 'y' });
    const t0 = await run.observe(nodeNow('bob'));
    await run.apply(connect, 'alice');
    await untilAcme(run, liveNote('bob', 'fast'), {
      pred: (v) => (v as { body?: string } | null)?.body === 'y',
      maxMs: 400,
      stepMs: 5,
    });
    const at = await run.observe(nodeNow('bob'));
    expect(at - t0).toBeLessThan(PEER_VISIBLE_BUDGET_MS);
    await run.apply(release, 'bob', 'sync');

    await expectConverged(run);
  });
});
