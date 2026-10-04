import { describe, expect, it } from 'bun:test';
import {
  defaultCursorSquare,
  moveCursor,
} from '@pkgs/chess-board-shared/keyboard-nav';

describe('keyboard-nav', () => {
  it('starts at the viewer bottom-left', () => {
    expect(defaultCursorSquare('white')).toBe('a1');
    expect(defaultCursorSquare('black')).toBe('h8');
  });

  it('stops at the board edge', () => {
    expect(moveCursor('a1', 'ArrowLeft', 'white')).toBeNull();
    expect(moveCursor('a1', 'ArrowDown', 'white')).toBeNull();
    expect(moveCursor('a1', 'ArrowUp', 'white')).toBe('a2');
    expect(moveCursor('a1', 'ArrowRight', 'white')).toBe('b1');
  });
});
