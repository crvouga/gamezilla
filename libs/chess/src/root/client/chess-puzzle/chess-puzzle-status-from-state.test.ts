import { describe, expect, test } from 'bun:test';

import { chessPuzzleStatusKindFromState } from '../../../public/chess-puzzle/chess-puzzle-status-from-state';

describe('chessPuzzleStatusKindFromState', () => {
  test('maps loading status to loading kind regardless of orientation', () => {
    expect(
      chessPuzzleStatusKindFromState({
        status: 'loading',
        orientation: 'white',
        showCorrectFlash: false,
      })
    ).toBe('loading');
    expect(
      chessPuzzleStatusKindFromState({
        status: 'loading',
        orientation: 'black',
        showCorrectFlash: true,
      })
    ).toBe('loading');
  });
});
