import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  expectConverged,
  foreground,
  lastMutationOk,
  liveNote,
  mutate,
  neverAcme,
  passTime,
  setNote,
  syncVirtualHost,
  untilAcme,
} from '../apps/acme';

describe('background pauses sweeps foreground catches up', () => {
  test('background pauses query sweeps until foreground', async () => {
    await using run = await start(acmeSystem, {
      seed: 507,
      host: syncVirtualHost(),
      knobs: acmeKnobs({
        clientCount: 0,
        rowImageFanout: false,
      }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');
    await run.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(run);

    await run.apply(foreground, 'bob', false);
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'while-bg' });
    await neverAcme(run, liveNote('bob', 'n1'), { forMs: 300 });

    await run.apply(foreground, 'bob', true);
    await untilAcme(run, liveNote('bob', 'n1'));
    await expectConverged(run);
    expect(await run.observe(liveNote('bob', 'n1'))).toMatchObject({
      body: 'while-bg',
    });
  });

  test('background does not block local mutate visibility', async () => {
    await using run = await start(acmeSystem, {
      seed: 508,
      host: syncVirtualHost(),
      knobs: acmeKnobs({
        clientCount: 0,
      }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(foreground, 'alice', false);
    await run.apply(mutate, 'alice', setNote, {
      id: 'local',
      body: 'bg-write',
    });
    expect(await run.observe(lastMutationOk('alice'))).toBe(true);
    expect(await run.observe(liveNote('alice', 'local'))).toMatchObject({
      body: 'bg-write',
    });
    // Drain upload while pumping sim time (dispose awaits upload stop).
    await run.apply(foreground, 'alice', true);
    await run.apply(passTime, 200);
  });
});
