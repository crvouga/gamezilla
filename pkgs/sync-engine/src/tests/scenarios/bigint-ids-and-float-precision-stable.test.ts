import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  notesDomainPack,
  setNote,
} from '../../domain-packs/notes-app';
import { openSimWorld } from '../../sim/world';

/** String ids that look like JS-unsafe bigints (stay exact as text). */
const BIG_IDS = [
  '9007199254740993',
  '18446744073709551615',
  '123456789012345678901234567890',
] as const;

describe('bigint ids and float precision stable', () => {
  test('string bigint ids and float JSON body round-trip stable', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 1010,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    const floatBody = JSON.stringify({
      pi: 3.141592653589793,
      tiny: 1e-15,
      big: 1.7976931348623157e308,
    });

    for (const id of BIG_IDS) {
      await a.mutate(setNote, { id, body: floatBody });
    }
    await world.assertConverged();

    for (const id of BIG_IDS) {
      await expectLiveNote(b.db, id, { body: floatBody });
      await expectLiveNote(world.server.db, id, { body: floatBody });
    }
    expect((JSON.parse(floatBody) as { readonly pi: number }).pi).toBe(
      3.141592653589793
    );
  });

  test.each([1011, 1012, 1013])(
    'seed sweep bigint-looking ids converge (seed=%i)',
    async (seed) => {
      await using world = await openSimWorld({
        domain: notesDomainPack,
        seed,
      });
      const a = await world.addClient({ id: 'alice' });
      await world.addClient({ id: 'bob' });
      const id = `${BIG_IDS[0]}-${seed}`;
      const body = JSON.stringify({ n: 0.1 + 0.2, seed });
      await a.mutate(setNote, { id, body });
      await world.assertConverged();
      await expectLiveNote(world.server.db, id, { body });
    }
  );
});
