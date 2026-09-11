import { describe, expect, test } from 'bun:test';

import { chessPuzzleStatusKindFromState } from '@libs/chess/public/puzzle-session';

describe('chessPuzzleStatusKindFromState', () => {
  test('maps loading status to loading kind regardless of orientation', () => {
    expect(
      chessPuzzleStatusKindFromState({
        status: 'loading',
        orientation: 'white',
      })
    ).toBe('loading');
    expect(
      chessPuzzleStatusKindFromState({
        status: 'loading',
        orientation: 'black',
      })
    ).toBe('loading');
  });

  test('maps solving to turn kind from orientation', () => {
    expect(
      chessPuzzleStatusKindFromState({
        status: 'solving',
        orientation: 'white',
      })
    ).toBe('whiteToMove');
    expect(
      chessPuzzleStatusKindFromState({
        status: 'solving',
        orientation: 'black',
      })
    ).toBe('blackToMove');
  });
});
