import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  connect,
  disconnect,
  expectConverged,
  hold,
  lastMutationId,
  lastMutationOk,
  liveNote,
  mutate,
  outcome,
  release,
  setNote,
  untilAcme,
} from '../apps/acme';

describe('interleaved mutate during upload inflight', () => {
  test('mutates while drain in flight join next batch; no loss', async () => {
    await using s = await acmeSystem.script({
      seed: 823,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    await s.apply(disconnect, 'alice');
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'first' });
    expect(await s.observe(lastMutationOk, 'alice')).toBe(true);
    await s.apply(mutate, 'alice', setNote, { id: 'n2', body: 'second' });
    expect(await s.observe(lastMutationOk, 'alice')).toBe(true);

    // Hold sync so the first upload stays in flight while more mutates land.
    await s.apply(hold, 'alice', 'sync');
    await s.apply(connect, 'alice');
    await s.elapse(50);

    await s.apply(mutate, 'alice', setNote, { id: 'n3', body: 'third' });
    expect(await s.observe(lastMutationOk, 'alice')).toBe(true);
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'first-v2' });
    expect(await s.observe(lastMutationOk, 'alice')).toBe(true);
    const fourthId = await s.observe(lastMutationId, 'alice');
    expect(fourthId).not.toBeNull();
    if (fourthId === null) return;

    await s.apply(release, 'alice', 'sync');
    await untilAcme(s, (s) => outcome(s, 'alice', fourthId));
    expect(await s.observe(outcome, 'alice', fourthId)).toBe('confirmed');
    await expectConverged(s);

    expect(await s.observe(liveNote, 'bob', 'n1')).toMatchObject({
      body: 'first-v2',
    });
    expect(await s.observe(liveNote, 'bob', 'n2')).toMatchObject({
      body: 'second',
    });
    expect(await s.observe(liveNote, 'bob', 'n3')).toMatchObject({
      body: 'third',
    });
  });
});
