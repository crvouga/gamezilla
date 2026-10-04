import { describe, expect, test } from 'bun:test';
import { AddOne, gameRoomModule, readTally } from '@pkgs/room-harness/game-room';
import { assertHashCanonical } from '@pkgs/room-harness/assert-hash-canonical';
import { createHarnessAdapters } from '@pkgs/uuid-shared/harness-adapters';

describe('kit: hash canonicality (M-F02)', () => {
  test('game room states hash independent of key insertion order', () => {
    const adapters = createHarnessAdapters({
      seed: process.env['HARNESS_SEED'] ?? '42',
      startMs: 1,
    });
    let state = gameRoomModule.initialState();
    for (let i = 0; i < 3; i += 1) {
      const res = gameRoomModule.handle(
        state,
        {
          id: adapters.createId(),
          ts: adapters.clock.now(),
          payload: AddOne({}),
        },
        'alice'
      );
      if (!res.ok) throw new Error('expected ok');
      for (const ev of res.events) state = gameRoomModule.reduce(state, ev);
    }
    expect(readTally(state)).toBe(3);
    assertHashCanonical(gameRoomModule, [gameRoomModule.initialState(), state]);
  });
});
