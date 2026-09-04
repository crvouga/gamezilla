import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  liveNote,
  mutate,
  setNote,
} from '../apps/acme';

describe('same actor two devices converge', () => {
  test('two devices same actor converge concurrent writes', async () => {
    await using s = await acmeSystem.script({
      seed: 509,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, {
      id: 'phone',
      actorId: 'user-1',
    });
    await s.apply(addClient, {
      id: 'tablet',
      actorId: 'user-1',
    });

    await s.apply(mutate, 'phone', setNote, { id: 'from-phone', body: 'p' });
    await s.apply(mutate, 'tablet', setNote, {
      id: 'from-tablet',
      body: 't',
    });
    await expectConverged(s);

    expect(await s.observe(liveNote, 'phone', 'from-phone')).toMatchObject({
      body: 'p',
    });
    expect(await s.observe(liveNote, 'phone', 'from-tablet')).toMatchObject({
      body: 't',
    });
    expect(await s.observe(liveNote, 'tablet', 'from-phone')).toMatchObject({
      body: 'p',
    });
    expect(await s.observe(liveNote, 'tablet', 'from-tablet')).toMatchObject({
      body: 't',
    });
  });
});
