import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  converge,
  hold,
  liveNote,
  mutate,
  net,
  passTime,
  release,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

describe('push seq gap forces refetch not image apply', () => {
  test('lost live push creates gap; later push still converges via refetch', async () => {
    await using run = await start(acmeSystem, {
      seed: 804,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });

    await run.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await run.apply(converge);

    // Drop the next live fanout (gap), keep sync so repair can refetch.
    await run.apply(net, 'bob', 'live', { dropProbability: 1 });
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'lost-push' });
    await run.apply(passTime, 80);
    await run.apply(net, 'bob', 'live', 'ok');

    // Contiguous-looking later push must not image-apply across the gap.
    await run.apply(hold, 'bob', 'sync');
    await run.apply(mutate, 'alice', setNote, { id: 'n2', body: 'after-gap' });
    await run.apply(passTime, 200);
    await run.apply(release, 'bob', 'sync');
    await run.apply(converge);

    expect(await run.observe(liveNote('bob', 'n1'))).toMatchObject({
      body: 'lost-push',
    });
    expect(await run.observe(liveNote('bob', 'n2'))).toMatchObject({
      body: 'after-gap',
    });
  });
});
