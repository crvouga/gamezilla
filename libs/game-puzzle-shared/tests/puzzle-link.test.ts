import { describe, expect, test } from 'bun:test';
import {
  puzzleIdOfLink,
  puzzleIdOfRouteParam,
  puzzleLink,
  puzzleLinkPath,
  puzzleLinkPathOf,
} from '@libs/game-puzzle-shared/puzzle-link';

describe('puzzle link', () => {
  test('the same puzzle always has the same link', () => {
    expect(puzzleLink('https://app.example', 'abc12')).toBe(
      puzzleLink('https://app.example', 'abc12')
    );
  });

  test('a link opens the puzzle it was shared for', () => {
    const link = puzzleLink('https://app.example', 'a b/c');
    expect(puzzleIdOfLink(link)).toBe('a b/c');
    expect(puzzleLinkPathOf(link)).toBe('/chess/puzzle/a%20b%2Fc');
  });

  test('a link without an origin is its path', () => {
    expect(puzzleLink(null, 'abc12')).toBe('/chess/puzzle/abc12');
  });

  // regression: puzzle-link-namespace-undecoded
  test("the link's route opens the puzzle of its own game's namespace", () => {
    const path = puzzleLinkPath('counting-race/leap-home');
    const param = path.slice('/chess/puzzle/'.length);
    expect(puzzleIdOfRouteParam(param)).toBe('counting-race/leap-home');
    expect(puzzleIdOfRouteParam('01Xbe')).toBe('01Xbe');
    expect(puzzleIdOfRouteParam('%E0%A4%A')).toBe('');
  });

  test('anything else is not a puzzle link', () => {
    expect(puzzleIdOfLink('https://app.example/space/x')).toBeNull();
  });
});
