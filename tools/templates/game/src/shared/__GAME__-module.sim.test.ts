import { describe, expect, test } from 'bun:test';
import { createSimAdapters } from '@pkgs/uuid';

import { __GAME_PASCAL__Module } from './__GAME__-module';

function runOnce(seed: number): string {
  const adapters = createSimAdapters({ seed, startMs: 0 });
  void adapters;
  const state = __GAME_PASCAL__Module.initialState();
  return __GAME_PASCAL__Module.hash(state);
}

describe('__GAME__ module sim determinism', () => {
  test('same seed yields identical state hash twice', () => {
    const seed = Number(process.env['SIM_SEED'] ?? '42');
    expect(runOnce(seed)).toBe(runOnce(seed));
  });
});
