import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  converge,
  liveNote,
  mutate,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

const EMOJI_RTL = 'hello 👋 مرحبا \u202Ertl';
const WITH_NULL = `before\u0000after-${'x'.repeat(32)}`;
const HUGE = `${'🚀'.repeat(50)}${'a'.repeat(100_000)}`;

describe('unicode null byte huge string roundtrip', () => {
  test('emoji RTL null-byte and huge body round-trip across peers', async () => {
    await using run = await start(acmeSystem, {
      seed: 990,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');

    await run.apply(mutate, 'alice', setNote, { id: 'emoji', body: EMOJI_RTL });
    await run.apply(mutate, 'alice', setNote, {
      id: 'nullish',
      body: WITH_NULL,
    });
    await run.apply(mutate, 'alice', setNote, { id: 'huge', body: HUGE });
    await run.apply(converge);

    expect(await run.observe(liveNote('bob', 'emoji'))).toMatchObject({
      body: EMOJI_RTL,
    });
    expect(await run.observe(liveNote('bob', 'nullish'))).toMatchObject({
      body: WITH_NULL,
    });
    expect(await run.observe(liveNote('bob', 'huge'))).toMatchObject({
      body: HUGE,
    });
    expect(await run.observe(liveNote('server', 'huge'))).toMatchObject({
      body: HUGE,
    });
    expect(HUGE.length).toBeGreaterThan(100_000);
  });

  test.each([991, 992, 993])(
    'seed sweep unicode bodies hash-stable converge (seed=%i)',
    async (seed) => {
      await using run = await start(acmeSystem, {
        seed: seed,
        host: syncVirtualHost(),
        draws: acmeDraws({ clientCount: 0 }),
        properties: [],
      });

      await run.apply(addClient, 'alice');
      await run.apply(addClient, 'bob');
      const body = `${EMOJI_RTL}-${seed}-\u0000`;
      await run.apply(mutate, 'alice', setNote, { id: `u-${seed}`, body });
      await run.apply(converge);
      expect(await run.observe(liveNote('bob', `u-${seed}`))).toMatchObject({
        body,
      });
    }
  );
});
