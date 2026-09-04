import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  liveNote,
  mutate,
  setNote,
} from '../apps/acme';

const EMOJI_RTL = 'hello 👋 مرحبا \u202Ertl';
const WITH_NULL = `before\u0000after-${'x'.repeat(32)}`;
const HUGE = `${'🚀'.repeat(50)}${'a'.repeat(100_000)}`;

describe('unicode null byte huge string roundtrip', () => {
  test('emoji RTL null-byte and huge body round-trip across peers', async () => {
    await using s = await acmeSystem.script({
      seed: 990,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');

    await s.apply(mutate, 'alice', setNote, { id: 'emoji', body: EMOJI_RTL });
    await s.apply(mutate, 'alice', setNote, {
      id: 'nullish',
      body: WITH_NULL,
    });
    await s.apply(mutate, 'alice', setNote, { id: 'huge', body: HUGE });
    await expectConverged(s);

    expect(await s.observe(liveNote, 'bob', 'emoji')).toMatchObject({
      body: EMOJI_RTL,
    });
    expect(await s.observe(liveNote, 'bob', 'nullish')).toMatchObject({
      body: WITH_NULL,
    });
    expect(await s.observe(liveNote, 'bob', 'huge')).toMatchObject({
      body: HUGE,
    });
    expect(await s.observe(liveNote, 'server', 'huge')).toMatchObject({
      body: HUGE,
    });
    expect(HUGE.length).toBeGreaterThan(100_000);
  });

  test.each([991, 992, 993])(
    'seed sweep unicode bodies hash-stable converge (seed=%i)',
    async (seed) => {
      await using s = await acmeSystem.script({
        seed: seed,
        args: { clientCount: 0 },
      });

      await s.apply(addClient, 'alice');
      await s.apply(addClient, 'bob');
      const body = `${EMOJI_RTL}-${seed}-\u0000`;
      await s.apply(mutate, 'alice', setNote, { id: `u-${seed}`, body });
      await expectConverged(s);
      expect(await s.observe(liveNote, 'bob', `u-${seed}`)).toMatchObject({
        body,
      });
    }
  );
});
