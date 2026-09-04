import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  foreground,
  lastMutationOk,
  liveNote,
  mutate,
  neverAcme,
  setNote,
  untilAcme,
} from '../apps/acme';

describe('background pauses sweeps foreground catches up', () => {
  test('background pauses query sweeps until foreground', async () => {
    await using s = await acmeSystem.script({
      seed: 507,
      args: {
        clientCount: 0,
        rowImageFanout: false,
      },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');
    await s.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(s);

    await s.apply(foreground, 'bob', false);
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'while-bg' });
    await neverAcme(s, (s) => liveNote(s, 'bob', 'n1'), { forMs: 300 });

    await s.apply(foreground, 'bob', true);
    await untilAcme(s, (s) => liveNote(s, 'bob', 'n1'));
    await expectConverged(s);
    expect(await s.observe(liveNote, 'bob', 'n1')).toMatchObject({
      body: 'while-bg',
    });
  });

  test('background does not block local mutate visibility', async () => {
    await using s = await acmeSystem.script({
      seed: 508,
      args: {
        clientCount: 0,
      },
    });

    await s.apply(addClient, 'alice');
    await s.apply(foreground, 'alice', false);
    await s.apply(mutate, 'alice', setNote, {
      id: 'local',
      body: 'bg-write',
    });
    expect(await s.observe(lastMutationOk, 'alice')).toBe(true);
    expect(await s.observe(liveNote, 'alice', 'local')).toMatchObject({
      body: 'bg-write',
    });
    // Drain upload while pumping sim time (dispose awaits upload stop).
    await s.apply(foreground, 'alice', true);
    await s.elapse(200);
  });
});
