import { expect, test } from 'bun:test';
import { readPuzzleRemainingToday } from '@libs/chess/harness/puzzle-control-reads';
import type { ProductHarness } from '@libs/harness/system/harness';
import { ElementNotFoundError } from '@pkgs/ui-testing';

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
  expect(await readPuzzleRemainingToday(surface, 'alice')).toBeNull();
});

test('a visible allowance retains its remaining count', async () => {
  const surface = allowanceSurface(async () => '17 puzzles remaining today');
  expect(await readPuzzleRemainingToday(surface, 'alice')).toBe(17);
});

test('an unrelated allowance read failure remains an error', async () => {
  const failure = new Error('driver disconnected');
  const surface = allowanceSurface(async () => {
    throw failure;
  });
  await expect(readPuzzleRemainingToday(surface, 'alice')).rejects.toBe(
    failure
  );
});
