import { describe, expect, test } from 'bun:test';

import { __GAME_PASCAL__Module } from './__GAME__-module';

describe('__GAME__ module', () => {
  test('initial state hashes stably', () => {
    const a = __GAME_PASCAL__Module.hash(__GAME_PASCAL__Module.initialState());
    const b = __GAME_PASCAL__Module.hash(__GAME_PASCAL__Module.initialState());
    expect(a).toBe(b);
  });
});
