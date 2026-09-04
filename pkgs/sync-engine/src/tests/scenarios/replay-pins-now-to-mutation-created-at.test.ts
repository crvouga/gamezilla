import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  connect,
  deleteNote,
  disconnect,
  expectConverged,
  lastMutationOk,
  mutate,
  nodeNow,
  setNote,
  skewClock,
} from '../apps/acme';
import {
  expectLiveNoteAt,
  expectNoteNotLiveAt,
  readNoteTombstoneAt,
} from '../apps/acme/reads';

describe('replay pins now to mutation created at', () => {
  test('replay pins env.now to mutation createdAt under client clock skew', async () => {
    await using s = await acmeSystem.script({
      seed: 720,
      args: { clientCount: 0 },
    });

    await s.apply(skewClock, 'alice', -60_000);
    await s.apply(skewClock, 'bob', 0);
    await s.apply(skewClock, 'server', 60_000);

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');

    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'live' });
    await expectConverged(s);

    await s.apply(disconnect, 'alice');
    const skewedNow = await s.observe(nodeNow, 'alice');
    await s.apply(mutate, 'alice', deleteNote, { id: 'n1' });
    expect(await s.observe(lastMutationOk, 'alice')).toBe(true);
    const expectedIso = new Date(skewedNow).toISOString();

    await s.apply(connect, 'alice');
    await expectConverged(s);

    await expectNoteNotLiveAt(s, 'alice', 'n1');
    await expectNoteNotLiveAt(s, 'bob', 'n1');
    await expectNoteNotLiveAt(s, 'server', 'n1');

    expect(await readNoteTombstoneAt(s, 'server', 'n1')).toBe(expectedIso);
    expect(await readNoteTombstoneAt(s, 'bob', 'n1')).toBe(expectedIso);
    expect(await readNoteTombstoneAt(s, 'alice', 'n1')).toBe(expectedIso);
  });

  test('rebase env.now pinned to createdAt under skew before upload', async () => {
    // Offline pending delete + peer merge before upload: rebase uses createdAt.
    await using s = await acmeSystem.script({
      seed: 721,
      args: { clientCount: 0 },
    });

    await s.apply(skewClock, 'alice', -120_000);
    await s.apply(skewClock, 'bob', 0);
    await s.apply(skewClock, 'server', 90_000);

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');

    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'live' });
    await expectConverged(s);

    await s.apply(disconnect, 'alice');
    const skewedNow = await s.observe(nodeNow, 'alice');
    await s.apply(mutate, 'alice', deleteNote, { id: 'n1' });
    expect(await s.observe(lastMutationOk, 'alice')).toBe(true);
    const expectedIso = new Date(skewedNow).toISOString();
    await expectNoteNotLiveAt(s, 'alice', 'n1');
    expect(await readNoteTombstoneAt(s, 'alice', 'n1')).toBe(expectedIso);

    // Peer write forces alice merge+rebase on reconnect before upload.
    await s.apply(mutate, 'bob', setNote, { id: 'n2', body: 'peer' });
    await s.elapse(200);

    await s.apply(connect, 'alice');
    await s.elapse(100);
    // Rebase must keep tombstone stamped with mutation createdAt, not wall now.
    expect(await readNoteTombstoneAt(s, 'alice', 'n1')).toBe(expectedIso);

    await expectConverged(s);

    await expectNoteNotLiveAt(s, 'alice', 'n1');
    await expectNoteNotLiveAt(s, 'bob', 'n1');
    await expectNoteNotLiveAt(s, 'server', 'n1');
    expect(await readNoteTombstoneAt(s, 'server', 'n1')).toBe(expectedIso);
    expect(await readNoteTombstoneAt(s, 'bob', 'n1')).toBe(expectedIso);
    await expectLiveNoteAt(s, 'bob', 'n2', { body: 'peer' });
  });
});
