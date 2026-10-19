import { expect, test } from 'bun:test';
import { readPuzzleStartsLeft } from '@libs/game-session-harness/puzzle-screen';
import type { ProductHarness } from '@libs/harness/harness';
import { ElementNotFoundError } from '@pkgs/ui-testing-root-shared/element-not-found-error';

function allowanceSurface(text: () => Promise<string | null>): ProductHarness {
  return {
    actors: new Map([
      ['alice', { ui: { get: () => ({ isVisible: async () => true, text }) } }],
    ]),
  } as unknown as ProductHarness;
}

// regression: puzzle-reconnect-allowance-disappears
test('an allowance removed after the visibility probe reads as absent', async () => {
  const surface = allowanceSurface(async () => {
    throw new ElementNotFoundError('testId("chess-puzzle-remaining-today")');
  });
  expect(await readPuzzleStartsLeft(surface, 'alice')).toBeNull();
});

test('a visible allowance retains its remaining count', async () => {
  const surface = allowanceSurface(async () => '17 puzzles remaining today');
  expect(await readPuzzleStartsLeft(surface, 'alice')).toBe(17);
});

test('an unrelated allowance read failure remains an error', async () => {
  const failure = new Error('driver disconnected');
  const surface = allowanceSurface(async () => {
    throw failure;
  });
  await expect(readPuzzleStartsLeft(surface, 'alice')).rejects.toBe(failure);
});
