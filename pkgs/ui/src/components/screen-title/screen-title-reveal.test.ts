import { describe, expect, test } from 'bun:test';

import {
  SCREEN_TITLE_REVEAL_OFFSET,
  shouldShowTopBarTitle,
} from './screen-title-reveal';

describe('shouldShowTopBarTitle', () => {
  test('hidden below offset', () => {
    expect(shouldShowTopBarTitle(0)).toBe(false);
    expect(shouldShowTopBarTitle(SCREEN_TITLE_REVEAL_OFFSET - 1)).toBe(false);
  });

  test('visible at and above offset', () => {
    expect(shouldShowTopBarTitle(SCREEN_TITLE_REVEAL_OFFSET)).toBe(true);
    expect(shouldShowTopBarTitle(SCREEN_TITLE_REVEAL_OFFSET + 100)).toBe(true);
  });
});
