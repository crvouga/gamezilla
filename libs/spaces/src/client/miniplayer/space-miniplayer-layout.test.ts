import { describe, expect, it } from 'bun:test';

import {
  isSpaceMiniplayerHidden,
  resolveMiniplayerMode,
} from './space-miniplayer-layout';

describe('isSpaceMiniplayerHidden', () => {
  it('hides on the full-screen space route', () => {
    expect(
      isSpaceMiniplayerHidden({
        rawPath: '/space/abc',
        activeSpaceCount: 1,
      })
    ).toBe(true);
  });

  it('hides when there are no active spaces', () => {
    expect(
      isSpaceMiniplayerHidden({
        rawPath: '/spaces',
        activeSpaceCount: 0,
      })
    ).toBe(true);
  });

  it('shows on tab routes with at least one active space', () => {
    expect(
      isSpaceMiniplayerHidden({
        rawPath: '/spaces',
        activeSpaceCount: 2,
      })
    ).toBe(false);
  });
});

describe('resolveMiniplayerMode', () => {
  it('returns hidden for an empty list', () => {
    expect(resolveMiniplayerMode([])).toEqual({
      mode: 'hidden',
      spaceIds: [],
    });
  });

  it('returns single for one space', () => {
    expect(resolveMiniplayerMode(['a'])).toEqual({
      mode: 'single',
      spaceIds: ['a'],
      primarySpaceId: 'a',
    });
  });

  it('returns stack for two or more spaces', () => {
    expect(resolveMiniplayerMode(['a', 'b', 'c'])).toEqual({
      mode: 'stack',
      spaceIds: ['a', 'b', 'c'],
      primarySpaceId: 'a',
    });
  });
});
