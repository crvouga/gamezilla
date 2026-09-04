import { describe, expect, test } from 'bun:test';
import {
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
  release,
  restart,
  setNote,
} from '../apps/acme';

describe('offline crash partition lifecycle matrix', () => {
  test('A offline while B writes; A online matches', async () => {
    await using s = await acmeSystem.script({
      seed: 201,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await s.apply(online, 'alice', false);
    await s.apply(mutate, 'bob', setNote, { id: 'n1', body: 'from-b' });
    await s.elapse(100);
    await s.apply(online, 'alice', true);
    await expectConverged(s);
    await expectLiveNoteAt(s, 'alice', 'n1', { body: 'from-b' });
    await expectEveryClientNotesAgree(s);
  });

  test('B offline while A writes; B online matches', async () => {
    await using s = await acmeSystem.script({
      seed: 202,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await s.apply(online, 'bob', false);
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'from-a' });
    await s.elapse(100);
    await s.apply(online, 'bob', true);
    await expectConverged(s);
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'from-a' });
    await expectEveryClientNotesAgree(s);
  });

  test('both offline divergent writes then online converge', async () => {
    await using s = await acmeSystem.script({
      seed: 203,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await s.apply(online, 'alice', false);
    await s.apply(online, 'bob', false);
    await s.apply(mutate, 'alice', setNote, { id: 'shared', body: 'a' });
    await s.apply(mutate, 'bob', setNote, { id: 'shared', body: 'b' });
    await s.apply(online, 'alice', true);
    await s.apply(online, 'bob', true);
    await expectConverged(s);

    const server = await s.observe(liveNotes, 'server');
    const winner = server.find((r) => r.id === 'shared');
    expect(winner?.body === 'a' || winner?.body === 'b').toBe(true);
    await expectEveryClientNotesAgree(s);
  });

  test('A crash+restart after B wrote rehydrates', async () => {
    await using s = await acmeSystem.script({
      seed: 204,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await s.apply(mutate, 'bob', setNote, { id: 'n1', body: 'from-b' });
    await expectConverged(s);
    await s.apply(crash, 'alice');
    await s.apply(restart, 'alice', {});
    await expectConverged(s);
    await expectLiveNoteAt(s, 'alice', 'n1', { body: 'from-b' });
  });

  test('B crash+restart after A wrote rehydrates', async () => {
    await using s = await acmeSystem.script({
      seed: 205,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'from-a' });
    await expectConverged(s);
    await s.apply(crash, 'bob');
    await s.apply(restart, 'bob', {});
    await expectConverged(s);
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'from-a' });
  });

  test('sequential A then B crash/restart after shared state', async () => {
    await using s = await acmeSystem.script({
      seed: 206,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'shared' });
    await expectConverged(s);
    await s.apply(crash, 'alice');
    await s.apply(restart, 'alice', {});
    await expectConverged(s);
    await s.apply(crash, 'bob');
    await s.apply(restart, 'bob', {});
    await expectConverged(s);
    await expectEveryClientNotesAgree(s);
    await expectLiveNoteAt(s, 'server', 'n1', { body: 'shared' });
  });

  test('server unreachable: both mutate locally then heal converges', async () => {
    await using s = await acmeSystem.script({
      seed: 207,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await s.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(s);

    // Server unreachable = both partitioned from server HTTP/pubsub.
    await s.apply(partition, 'alice', 'all');
    await s.apply(partition, 'bob', 'all');
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'a-local' });
    await s.apply(mutate, 'bob', setNote, { id: 'n2', body: 'b-local' });
    await s.elapse(100);

    await expectConverged(s);
    await expectLiveNoteAt(s, 'alice', 'n1', { body: 'a-local' });
    await expectLiveNoteAt(s, 'bob', 'n2', { body: 'b-local' });
    await expectEveryClientNotesAgree(s);
  });

  test('staggered: A partitioned, B writes; heal A; B offline writes', async () => {
    await using s = await acmeSystem.script({
      seed: 208,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await s.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(s);

    await s.apply(partition, 'alice', 'all');
    await s.apply(mutate, 'bob', setNote, { id: 'n1', body: 'from-b' });
    await s.elapse(80);
    await expectConverged(s);
    await expectLiveNoteAt(s, 'alice', 'n1', { body: 'from-b' });

    await s.apply(online, 'bob', false);
    await s.apply(mutate, 'bob', setNote, { id: 'n2', body: 'b-queued' });
    await s.elapse(40);
    await s.apply(online, 'bob', true);
    await expectConverged(s);
    await expectLiveNoteAt(s, 'alice', 'n2', { body: 'b-queued' });
    await expectEveryClientNotesAgree(s);
  });

  test('flip-flop offline and partition around contested note', async () => {
    await using s = await acmeSystem.script({
      seed: 209,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    await s.apply(online, 'alice', false);
    await s.apply(mutate, 'alice', setNote, { id: 'flip', body: 'a1' });
    await s.apply(online, 'alice', true);
    await s.elapse(40);

    await s.apply(partition, 'bob', 'all');
    await s.apply(mutate, 'bob', setNote, { id: 'flip', body: 'b1' });
    await s.apply(release, 'bob', 'all');
    await s.elapse(40);

    await s.apply(online, 'bob', false);
    await s.apply(mutate, 'alice', setNote, { id: 'flip', body: 'a2' });
    await s.apply(online, 'bob', true);
    await expectConverged(s);

    const server = await s.observe(liveNotes, 'server');
    expect(server.find((r) => r.id === 'flip')).toBeDefined();
    await expectEveryClientNotesAgree(s);
  });
});
