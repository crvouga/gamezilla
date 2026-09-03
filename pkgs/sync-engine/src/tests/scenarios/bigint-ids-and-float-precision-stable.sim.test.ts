import { describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  expectConverged,
  mutate,
  setNote,
  syncVirtualHost,
} from '../apps/acme';
import { expectLiveNoteAt } from '../apps/acme/reads';

/** String ids that look like JS-unsafe bigints (stay exact as text). */
const BIG_IDS = [
  '9007199254740993',
  '18446744073709551615',
  '123456789012345678901234567890',
] as const;

describe('bigint ids and float precision stable', () => {
  test('string bigint ids and float JSON body round-trip stable', async () => {
    await using run = await script(acmeSystem, {
      seed: 1010,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');

    const floatBody = JSON.stringify({
      pi: 3.141592653589793,
      tiny: 1e-15,
      big: 1.7976931348623157e308,
    });

    for (const id of BIG_IDS) {
      await run.apply(mutate, 'alice', setNote, { id, body: floatBody });
    }
    await expectConverged(run);

    for (const id of BIG_IDS) {
      await expectLiveNoteAt(run, 'bob', id, { body: floatBody });
      await expectLiveNoteAt(run, 'server', id, { body: floatBody });
    }
    expect((JSON.parse(floatBody) as { readonly pi: number }).pi).toBe(
      3.141592653589793
    );
  });

  test.each([1011, 1012, 1013])(
    'seed sweep bigint-looking ids converge (seed=%i)',
    async (seed) => {
      await using run = await script(acmeSystem, {
        seed,
        host: syncVirtualHost(),
        knobs: acmeKnobs({ clientCount: 0 }),
        properties: [],
      });

      await run.apply(addClient, 'alice');
      await run.apply(addClient, 'bob');
      const id = `${BIG_IDS[0]}-${seed}`;
      const body = JSON.stringify({ n: 0.1 + 0.2, seed });
      await run.apply(mutate, 'alice', setNote, { id, body });
      await expectConverged(run);
      await expectLiveNoteAt(run, 'server', id, { body });
    }
  );
});
