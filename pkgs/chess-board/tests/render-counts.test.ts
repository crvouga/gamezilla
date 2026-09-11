import {
  createRenderCounter,
  isChessBoardDevInstrumentation,
} from '@pkgs/chess-board/dev/render-counts';
import { describe, expect, it } from 'vitest';

type DevGlobal = typeof globalThis & { __CHESS_BOARD_DEV__?: boolean };

describe('createRenderCounter', () => {
  it('no-ops when disabled', () => {
    const c = createRenderCounter(false);
    c.bump('pieces');
    expect(c.snapshot().pieces).toBe(0);
  });

  it('counts and resets when enabled', () => {
    const c = createRenderCounter(true);
    c.bump('squares');
    c.bump('pieces');
    c.bump('pieces');
    expect(c.snapshot()).toEqual({
      squares: 1,
      pieces: 2,
      arrows: 0,
      feedback: 0,
      ghost: 0,
    });
    c.reset();
    expect(c.snapshot().pieces).toBe(0);
  });
});

describe('isChessBoardDevInstrumentation', () => {
  it('is false unless the explicit flag is set', () => {
    const g = globalThis as DevGlobal;
    const prev = g.__CHESS_BOARD_DEV__;
    delete g.__CHESS_BOARD_DEV__;
    expect(isChessBoardDevInstrumentation()).toBe(false);
    g.__CHESS_BOARD_DEV__ = true;
    expect(typeof isChessBoardDevInstrumentation()).toBe('boolean');
    if (prev === undefined) delete g.__CHESS_BOARD_DEV__;
    else g.__CHESS_BOARD_DEV__ = prev;
  });
});
