import { describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  crash,
  expectConverged,
  expectEveryClientNotesAgree,
  expectLiveNoteAt,
  liveNotes,
  mutate,
  online,
  partition,
  passTime,
  release,
  restart,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

describe('offline crash partition lifecycle matrix', () => {
  test('A offline while B writes; A online matches', async () => {
    await using run = await script(acmeSystem, {
      seed: 201,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });
    await run.apply(online, 'alice', false);
    await run.apply(mutate, 'bob', setNote, { id: 'n1', body: 'from-b' });
    await run.apply(passTime, 100);
    await run.apply(online, 'alice', true);
    await expectConverged(run);
    await expectLiveNoteAt(run, 'alice', 'n1', { body: 'from-b' });
    await expectEveryClientNotesAgree(run);
  });

  test('B offline while A writes; B online matches', async () => {
    await using run = await script(acmeSystem, {
      seed: 202,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });
    await run.apply(online, 'bob', false);
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'from-a' });
    await run.apply(passTime, 100);
    await run.apply(online, 'bob', true);
    await expectConverged(run);
    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'from-a' });
    await expectEveryClientNotesAgree(run);
  });

  test('both offline divergent writes then online converge', async () => {
    await using run = await script(acmeSystem, {
      seed: 203,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });
    await run.apply(online, 'alice', false);
    await run.apply(online, 'bob', false);
    await run.apply(mutate, 'alice', setNote, { id: 'shared', body: 'a' });
    await run.apply(mutate, 'bob', setNote, { id: 'shared', body: 'b' });
    await run.apply(online, 'alice', true);
    await run.apply(online, 'bob', true);
    await expectConverged(run);

    const server = await run.observe(liveNotes('server'));
    const winner = server.find((r) => r.id === 'shared');
    expect(winner?.body === 'a' || winner?.body === 'b').toBe(true);
    await expectEveryClientNotesAgree(run);
  });

  test('A crash+restart after B wrote rehydrates', async () => {
    await using run = await script(acmeSystem, {
      seed: 204,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });
    await run.apply(mutate, 'bob', setNote, { id: 'n1', body: 'from-b' });
    await expectConverged(run);
    await run.apply(crash, 'alice');
    await run.apply(restart, 'alice', {});
    await expectConverged(run);
    await expectLiveNoteAt(run, 'alice', 'n1', { body: 'from-b' });
  });

  test('B crash+restart after A wrote rehydrates', async () => {
    await using run = await script(acmeSystem, {
      seed: 205,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'from-a' });
    await expectConverged(run);
    await run.apply(crash, 'bob');
    await run.apply(restart, 'bob', {});
    await expectConverged(run);
    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'from-a' });
  });

  test('sequential A then B crash/restart after shared state', async () => {
    await using run = await script(acmeSystem, {
      seed: 206,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'shared' });
    await expectConverged(run);
    await run.apply(crash, 'alice');
    await run.apply(restart, 'alice', {});
    await expectConverged(run);
    await run.apply(crash, 'bob');
    await run.apply(restart, 'bob', {});
    await expectConverged(run);
    await expectEveryClientNotesAgree(run);
    await expectLiveNoteAt(run, 'server', 'n1', { body: 'shared' });
  });

  test('server unreachable: both mutate locally then heal converges', async () => {
    await using run = await script(acmeSystem, {
      seed: 207,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });
    await run.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(run);

    // Server unreachable = both partitioned from server HTTP/pubsub.
    await run.apply(partition, 'alice', 'all');
    await run.apply(partition, 'bob', 'all');
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'a-local' });
    await run.apply(mutate, 'bob', setNote, { id: 'n2', body: 'b-local' });
    await run.apply(passTime, 100);

    await expectConverged(run);
    await expectLiveNoteAt(run, 'alice', 'n1', { body: 'a-local' });
    await expectLiveNoteAt(run, 'bob', 'n2', { body: 'b-local' });
    await expectEveryClientNotesAgree(run);
  });

  test('staggered: A partitioned, B writes; heal A; B offline writes', async () => {
    await using run = await script(acmeSystem, {
      seed: 208,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });
    await run.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(run);

    await run.apply(partition, 'alice', 'all');
    await run.apply(mutate, 'bob', setNote, { id: 'n1', body: 'from-b' });
    await run.apply(passTime, 80);
    await expectConverged(run);
    await expectLiveNoteAt(run, 'alice', 'n1', { body: 'from-b' });

    await run.apply(online, 'bob', false);
    await run.apply(mutate, 'bob', setNote, { id: 'n2', body: 'b-queued' });
    await run.apply(passTime, 40);
    await run.apply(online, 'bob', true);
    await expectConverged(run);
    await expectLiveNoteAt(run, 'alice', 'n2', { body: 'b-queued' });
    await expectEveryClientNotesAgree(run);
  });

  test('flip-flop offline and partition around contested note', async () => {
    await using run = await script(acmeSystem, {
      seed: 209,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });

    await run.apply(online, 'alice', false);
    await run.apply(mutate, 'alice', setNote, { id: 'flip', body: 'a1' });
    await run.apply(online, 'alice', true);
    await run.apply(passTime, 40);

    await run.apply(partition, 'bob', 'all');
    await run.apply(mutate, 'bob', setNote, { id: 'flip', body: 'b1' });
    await run.apply(release, 'bob', 'all');
    await run.apply(passTime, 40);

    await run.apply(online, 'bob', false);
    await run.apply(mutate, 'alice', setNote, { id: 'flip', body: 'a2' });
    await run.apply(online, 'bob', true);
    await expectConverged(run);

    const server = await run.observe(liveNotes('server'));
    expect(server.find((r) => r.id === 'flip')).toBeDefined();
    await expectEveryClientNotesAgree(run);
  });
});
