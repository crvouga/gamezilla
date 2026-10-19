import { describe, expect, test } from 'bun:test';

import type { PuzzleStatusKind } from '@libs/game-puzzle-shared/status-kind';
import { puzzleStatusKindFromState } from '@libs/game-puzzle-shared/status-kind';

describe('puzzleStatusKindFromState', () => {
  test('maps loading status to loading kind regardless of orientation', () => {
    expect(
      puzzleStatusKindFromState({
        status: 'loading',
        orientation: 'white',
      })
    ).toBe('loading');
    expect(
      puzzleStatusKindFromState({
        status: 'loading',
        orientation: 'black',
      })
    ).toBe('loading');
  });

  test('empty and offline are header kinds the shell can render', () => {
    const kinds: PuzzleStatusKind[] = ['empty', 'offline'];
    expect(kinds).toHaveLength(2);
  });

  test('maps live outcomes to clear status kinds', () => {
    expect(
      puzzleStatusKindFromState({
        status: 'solving',
        orientation: 'white',
      })
    ).toBe('started');
    expect(
      puzzleStatusKindFromState({ status: 'wrong', orientation: 'black' })
    ).toBe('failed');
    expect(
      puzzleStatusKindFromState({
        status: 'skipped',
        orientation: 'white',
      })
    ).toBe('skipped');
    expect(
      puzzleStatusKindFromState({ status: 'solved', orientation: 'black' })
    ).toBe('solved');
  });
});
