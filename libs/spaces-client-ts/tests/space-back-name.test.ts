/** Where the space's back control says it goes, from every screen. */

import { expect, test } from 'bun:test';
import { spaceBackName } from '@libs/spaces-client-ts/space-back-name';

// regression: space-bar-competing-nav-controls
test.each([
  {
    where: 'the list of games',
    input: { place: undefined, hasBack: false, backLabel: undefined },
    back: undefined,
  },
  {
    where: 'a game’s own menu',
    input: { place: 'Chess', hasBack: true, backLabel: 'Games' },
    back: 'Friday game night',
  },
  {
    where: 'a screen the game opens',
    input: { place: 'Chess', hasBack: true, backLabel: 'Chess' },
    back: 'Chess',
  },
  {
    where: 'a screen deeper in the game, its Back unnamed',
    input: { place: 'Chess', hasBack: true, backLabel: undefined },
    back: 'Chess',
  },
  {
    where: 'the first load, before any game',
    input: { place: undefined, hasBack: true, backLabel: undefined },
    back: undefined,
  },
] as const)('$where', ({ input, back }) => {
  expect(spaceBackName({ ...input, room: 'Friday game night' })).toBe(back);
});
