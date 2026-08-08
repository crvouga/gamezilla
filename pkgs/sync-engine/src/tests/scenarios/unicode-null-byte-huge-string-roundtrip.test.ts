import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  notesDomainPack,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

const EMOJI_RTL = 'hello 👋 مرحبا \u202Ertl';
const WITH_NULL = `before\u0000after-${'x'.repeat(32)}`;
const HUGE = `${'🚀'.repeat(50)}${'a'.repeat(100_000)}`;

describe('unicode null byte huge string roundtrip', () => {
  test('emoji RTL null-byte and huge body round-trip across peers', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 990,
      faults: RELIABLE_FAULTS,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      await a.mutate(setNote, { id: 'emoji', body: EMOJI_RTL });
      await a.mutate(setNote, { id: 'nullish', body: WITH_NULL });
      await a.mutate(setNote, { id: 'huge', body: HUGE });
      await world.assertConverged();

      await expectLiveNote(b.db, 'emoji', { body: EMOJI_RTL });
      await expectLiveNote(b.db, 'nullish', { body: WITH_NULL });
      await expectLiveNote(b.db, 'huge', { body: HUGE });
      await expectLiveNote(world.server.db, 'huge', { body: HUGE });
      expect(HUGE.length).toBeGreaterThan(100_000);
    } finally {
      await world.dispose();
    }
  });

  test('seed sweep unicode bodies hash-stable converge', async () => {
    for (const seed of [991, 992, 993] as const) {
      const world = await openSimWorld({
        domain: notesDomainPack,
        seed,
        faults: RELIABLE_FAULTS,
      });
      try {
        const a = await world.addClient({ id: 'alice' });
        const b = await world.addClient({ id: 'bob' });
        const body = `${EMOJI_RTL}-${seed}-\u0000`;
        await a.mutate(setNote, { id: `u-${seed}`, body });
        await world.assertConverged();
        await expectLiveNote(b.db, `u-${seed}`, { body });
      } finally {
        await world.dispose();
      }
    }
  });
});
