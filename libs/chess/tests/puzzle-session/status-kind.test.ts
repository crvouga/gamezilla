import { describe, expect, test } from 'bun:test';

import {
  type ChessPuzzleStatusKind,
  chessPuzzleStatusKindFromState,
} from '@libs/chess/public/puzzle-session';

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

  test('empty and offline are header kinds the shell can render', () => {
    const kinds: ChessPuzzleStatusKind[] = ['empty', 'offline'];
    expect(kinds).toHaveLength(2);
  });

  test('maps live outcomes to clear status kinds', () => {
    expect(
      chessPuzzleStatusKindFromState({
        status: 'solving',
        orientation: 'white',
      })
    ).toBe('started');
    expect(
      chessPuzzleStatusKindFromState({ status: 'wrong', orientation: 'black' })
    ).toBe('failed');
    expect(
      chessPuzzleStatusKindFromState({
        status: 'skipped',
        orientation: 'white',
      })
    ).toBe('skipped');
    expect(
      chessPuzzleStatusKindFromState({ status: 'solved', orientation: 'black' })
    ).toBe('solved');
  });
});
