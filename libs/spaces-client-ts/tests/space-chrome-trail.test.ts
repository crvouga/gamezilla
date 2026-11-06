/** Which place the space's bar names as current, and which as the way back. */

import { expect, test } from 'bun:test';
import {
  spaceBackName,
  spaceTrail,
} from '@libs/spaces-client-ts/space-chrome-trail';

// regression: space-bar-competing-nav-controls
test.each([
  {
    where: 'the list of games',
    input: { place: undefined, hasBack: false, backLabel: undefined },
    trail: { room: 'current', place: null },
    back: undefined,
  },
  {
    where: 'a game’s own menu',
    input: { place: 'Chess', hasBack: true, backLabel: 'Games' },
    trail: { room: 'parent', place: 'current' },
    back: 'Friday game night',
  },
  {
    where: 'a screen the game opens',
    input: { place: 'Chess', hasBack: true, backLabel: 'Chess' },
    trail: { room: 'ancestor', place: 'parent' },
    back: 'Chess',
  },
  {
    where: 'a screen deeper in the game, its Back unnamed',
    input: { place: 'Chess', hasBack: true, backLabel: undefined },
    trail: { room: 'ancestor', place: 'parent' },
    back: 'Chess',
  },
  {
    where: 'the first load, before any game',
    input: { place: undefined, hasBack: true, backLabel: undefined },
    trail: { room: 'current', place: null },
    back: undefined,
  },
] as const)('$where', ({ input, trail, back }) => {
  expect(spaceTrail(input)).toEqual(trail);
  expect(spaceBackName({ ...input, room: 'Friday game night' })).toBe(back);
});
