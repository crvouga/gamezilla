import { describe, expect, test } from 'bun:test';

import { wallIo } from './wall-io';

describe('wallIo', () => {
  test('construction does not require reading seed', () => {
    const io = wallIo();
    expect(typeof io.createId).toBe('function');
    expect(typeof io.clock.now).toBe('function');
  });

  test('seed is stable across reads', () => {
    const io = wallIo();
    expect(io.seed).toBe(io.seed);
  });
});
