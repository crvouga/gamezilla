import { expect, test } from 'bun:test';
import {
  liveHeartbeatSchema,
  liveNotice,
  placeOfRoute,
} from '@libs/synthetic-population-shared-ts/live-session';

test('a route is reported only as the place in the app it belongs to', () => {
  expect(placeOfRoute('/')).toBe('spaces');
  expect(placeOfRoute('/space/5b0e7c2a-0000-4000-8000-0000000000a1')).toBe(
    'space'
  );
  expect(placeOfRoute('/search?q=carol')).toBe('people-search');
  expect(placeOfRoute('/more')).toBe('settings');
  expect(placeOfRoute('/more/billing')).toBe('settings');
  expect(placeOfRoute('/profile/friends')).toBe('profile');
  expect(placeOfRoute('/notifications')).toBe('notifications');
  expect(placeOfRoute('/admin/synthetic-population')).toBe('observatory');
  expect(placeOfRoute('/somewhere-new')).toBe('other');
});

test('a heartbeat carries a place, an activity and at most a game name', () => {
  expect(
    liveHeartbeatSchema.safeParse({
      place: 'space',
      activity: 'looking',
      game: 'Chess',
    }).success
  ).toBe(true);
  expect(
    liveHeartbeatSchema.safeParse({
      place: '/search?q=carol',
      activity: 'browsing',
      game: null,
    }).success
  ).toBe(false);
});

test('only well-formed notices are read from the observatory topic', () => {
  expect(liveNotice({ type: 'live-frame', sessionId: 'abc' })).toEqual({
    type: 'live-frame',
    sessionId: 'abc',
  });
  expect(liveNotice({ type: 'synthetic-population-changed' })).toEqual({
    type: 'synthetic-population-changed',
    sessionId: null,
  });
  expect(liveNotice('nope')).toBeNull();
});
