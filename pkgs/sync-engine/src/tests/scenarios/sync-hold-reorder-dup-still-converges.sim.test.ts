import { describe, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  expectConverged,
  expectEveryClientNotesAgree,
  expectLiveNoteAt,
  hold,
  mutate,
  net,
  passTime,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

describe('sync hold reorder dup still converges', () => {
  test('held sync still converges after release', async () => {
    await using run = await start(acmeSystem, {
      seed: 503,
      host: syncVirtualHost(),
      draws: acmeDraws({
        clientCount: 0,
        rowImageFanout: false,
      }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });
    await run.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(run);

    await run.apply(hold, 'bob', 'sync');
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'held-sync' });
    await run.apply(passTime, 80);

    await expectConverged(run);
    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'held-sync' });
    await expectEveryClientNotesAgree(run);
  });

  test('reordered sync still converges', async () => {
    await using run = await start(acmeSystem, {
      seed: 504,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });
    await run.apply(net, 'bob', 'sync', {
      latencyMeanMs: 20,
      latencyJitterMs: 40,
      reorderWindow: 5,
    });
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'a' });
    await run.apply(mutate, 'alice', setNote, { id: 'n2', body: 'b' });
    await run.apply(mutate, 'alice', setNote, { id: 'n3', body: 'c' });
    await expectConverged(run);
    await expectLiveNoteAt(run, 'bob', 'n2', { body: 'b' });
    await expectEveryClientNotesAgree(run);
  });

  test('duplicate sync still converges', async () => {
    await using run = await start(acmeSystem, {
      seed: 505,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });
    await run.apply(net, 'bob', 'sync', { packetReplayProbability: 1 });
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'dup-sync' });
    await expectConverged(run);
    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'dup-sync' });
    await expectEveryClientNotesAgree(run);
  });
});
