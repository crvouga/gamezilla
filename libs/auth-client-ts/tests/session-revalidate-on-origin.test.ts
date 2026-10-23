import { expect, test } from 'bun:test';
import { originRevalidate } from '@libs/auth-client-ts/session-revalidate-on-origin';

// regression: reconnect-rechecks-session
test('a session recheck is armed only by an outage', () => {
  expect(originRevalidate(false, 'available')).toEqual({
    sawUnavailable: false,
    revalidate: false,
  });
  expect(originRevalidate(false, 'probing')).toEqual({
    sawUnavailable: false,
    revalidate: false,
  });
  const down = originRevalidate(false, 'unavailable');
  expect(down).toEqual({ sawUnavailable: true, revalidate: false });
  expect(originRevalidate(down.sawUnavailable, 'probing')).toEqual({
    sawUnavailable: true,
    revalidate: false,
  });
  expect(originRevalidate(true, 'available')).toEqual({
    sawUnavailable: false,
    revalidate: true,
  });
});
