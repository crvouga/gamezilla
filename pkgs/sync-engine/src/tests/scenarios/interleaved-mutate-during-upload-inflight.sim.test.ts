import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  connect,
  converge,
  disconnect,
  hold,
  lastMutationId,
  lastMutationOk,
  liveNote,
  mutate,
  outcome,
  passTime,
  release,
  setNote,
  syncVirtualHost,
  untilAcme,
} from '../apps/acme';

describe('interleaved mutate during upload inflight', () => {
  test('mutates while drain in flight join next batch; no loss', async () => {
    await using run = await start(acmeSystem, {
      seed: 823,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });

    await run.apply(disconnect, 'alice');
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'first' });
    expect(await run.observe(lastMutationOk('alice'))).toBe(true);
    await run.apply(mutate, 'alice', setNote, { id: 'n2', body: 'second' });
    expect(await run.observe(lastMutationOk('alice'))).toBe(true);

    // Hold sync so the first upload stays in flight while more mutates land.
    await run.apply(hold, 'alice', 'sync');
    await run.apply(connect, 'alice');
    await run.apply(passTime, 50);

    await run.apply(mutate, 'alice', setNote, { id: 'n3', body: 'third' });
    expect(await run.observe(lastMutationOk('alice'))).toBe(true);
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'first-v2' });
    expect(await run.observe(lastMutationOk('alice'))).toBe(true);
    const fourthId = await run.observe(lastMutationId('alice'));
    expect(fourthId).not.toBeNull();
    if (fourthId === null) return;

    await run.apply(release, 'alice', 'sync');
    await untilAcme(run, outcome('alice', fourthId));
    expect(await run.observe(outcome('alice', fourthId))).toBe('confirmed');
    await run.apply(converge);

    expect(await run.observe(liveNote('bob', 'n1'))).toMatchObject({
      body: 'first-v2',
    });
    expect(await run.observe(liveNote('bob', 'n2'))).toMatchObject({
      body: 'second',
    });
    expect(await run.observe(liveNote('bob', 'n3'))).toMatchObject({
      body: 'third',
    });
  });
});
