import { expect, test } from 'bun:test';
import { dispatchViewBlur } from '@pkgs/chess-board-root-harness-ts/chess-board';

// regression: board-blur-event-realm
test('switching away can blur the worker window', () => {
  expect(() => dispatchViewBlur(window)).not.toThrow();
});
