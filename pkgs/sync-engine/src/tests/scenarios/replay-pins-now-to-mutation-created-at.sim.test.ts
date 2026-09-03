import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  connect,
  deleteNote,
  disconnect,
  expectConverged,
  lastMutationOk,
  mutate,
  nodeNow,
  passTime,
  setNote,
  skewClock,
  syncVirtualHost,
} from '../apps/acme';
import {
  expectLiveNoteAt,
  expectNoteNotLiveAt,
  readNoteTombstoneAt,
} from '../apps/acme/reads';

describe('replay pins now to mutation created at', () => {
  test('replay pins env.now to mutation createdAt under client clock skew', async () => {
    await using run = await start(acmeSystem, {
      seed: 720,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(skewClock, 'alice', -60_000);
    await run.apply(skewClock, 'bob', 0);
    await run.apply(skewClock, 'server', 60_000);

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');

    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'live' });
    await expectConverged(run);

    await run.apply(disconnect, 'alice');
    const skewedNow = await run.observe(nodeNow('alice'));
    await run.apply(mutate, 'alice', deleteNote, { id: 'n1' });
    expect(await run.observe(lastMutationOk('alice'))).toBe(true);
    const expectedIso = new Date(skewedNow).toISOString();

    await run.apply(connect, 'alice');
    await expectConverged(run);

    await expectNoteNotLiveAt(run, 'alice', 'n1');
    await expectNoteNotLiveAt(run, 'bob', 'n1');
    await expectNoteNotLiveAt(run, 'server', 'n1');

    expect(await readNoteTombstoneAt(run, 'server', 'n1')).toBe(expectedIso);
    expect(await readNoteTombstoneAt(run, 'bob', 'n1')).toBe(expectedIso);
    expect(await readNoteTombstoneAt(run, 'alice', 'n1')).toBe(expectedIso);
  });

  test('rebase env.now pinned to createdAt under skew before upload', async () => {
    // Offline pending delete + peer merge before upload: rebase uses createdAt.
    await using run = await start(acmeSystem, {
      seed: 721,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(skewClock, 'alice', -120_000);
    await run.apply(skewClock, 'bob', 0);
    await run.apply(skewClock, 'server', 90_000);

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');

    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'live' });
    await expectConverged(run);

    await run.apply(disconnect, 'alice');
    const skewedNow = await run.observe(nodeNow('alice'));
    await run.apply(mutate, 'alice', deleteNote, { id: 'n1' });
    expect(await run.observe(lastMutationOk('alice'))).toBe(true);
    const expectedIso = new Date(skewedNow).toISOString();
    await expectNoteNotLiveAt(run, 'alice', 'n1');
    expect(await readNoteTombstoneAt(run, 'alice', 'n1')).toBe(expectedIso);

    // Peer write forces alice merge+rebase on reconnect before upload.
    await run.apply(mutate, 'bob', setNote, { id: 'n2', body: 'peer' });
    await run.apply(passTime, 200);

    await run.apply(connect, 'alice');
    await run.apply(passTime, 100);
    // Rebase must keep tombstone stamped with mutation createdAt, not wall now.
    expect(await readNoteTombstoneAt(run, 'alice', 'n1')).toBe(expectedIso);

    await expectConverged(run);

    await expectNoteNotLiveAt(run, 'alice', 'n1');
    await expectNoteNotLiveAt(run, 'bob', 'n1');
    await expectNoteNotLiveAt(run, 'server', 'n1');
    expect(await readNoteTombstoneAt(run, 'server', 'n1')).toBe(expectedIso);
    expect(await readNoteTombstoneAt(run, 'bob', 'n1')).toBe(expectedIso);
    await expectLiveNoteAt(run, 'bob', 'n2', { body: 'peer' });
  });
});
