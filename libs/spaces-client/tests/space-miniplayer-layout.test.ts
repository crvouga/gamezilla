import { describe, expect, it } from 'bun:test';

import {
  isSpaceMiniplayerHidden,
  resolveMiniplayerFrame,
  resolveMiniplayerMode,
} from '@libs/spaces-client/space-miniplayer-layout';

describe('resolveMiniplayerFrame', () => {
  it('spans full width with square corners on compact', () => {
    expect(resolveMiniplayerFrame('compact')).toEqual({
      rounded: false,
    });
  });

  it('spans the AppFrame column with soft corners on wide', () => {
    expect(resolveMiniplayerFrame('wide')).toEqual({
      rounded: true,
    });
  });
});

describe('isSpaceMiniplayerHidden', () => {
  it('hides when there are no active spaces', () => {
    expect(isSpaceMiniplayerHidden({ activeSpaceCount: 0 })).toBe(true);
  });

  it('shows with at least one active space', () => {
    expect(isSpaceMiniplayerHidden({ activeSpaceCount: 1 })).toBe(false);
    expect(isSpaceMiniplayerHidden({ activeSpaceCount: 2 })).toBe(false);
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
