// goal:works-offline:5
// goal:always-true:2
import { describe, expect, test } from 'bun:test';
import {
  addClient,
  exampleSystem,
  expectInSync,
  liveNote,
  mutate,
  setNote,
} from '@pkgs/sync-engine/sim';

describe('same actor two devices converge', () => {
  test('two devices same actor converge concurrent writes', async () => {
    await using s = await exampleSystem.run({
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
    await expectInSync(s);

    expect(await s.read(liveNote, 'phone', 'from-phone')).toMatchObject({
      body: 'p',
    });
    expect(await s.read(liveNote, 'phone', 'from-tablet')).toMatchObject({
      body: 't',
    });
    expect(await s.read(liveNote, 'tablet', 'from-phone')).toMatchObject({
      body: 'p',
    });
    expect(await s.read(liveNote, 'tablet', 'from-tablet')).toMatchObject({
      body: 't',
    });
  });
});
