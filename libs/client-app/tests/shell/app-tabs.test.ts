import { describe, expect, test } from 'bun:test';
import { isAppTabActive } from '@libs/client-app/routes/is-app-tab-active';

describe('isAppTabActive', () => {
  test('root tab matches only the root path', () => {
    expect(isAppTabActive('/', '/')).toBe(true);
    expect(isAppTabActive('/', '')).toBe(true);
    expect(isAppTabActive('/', '/search')).toBe(false);
    expect(isAppTabActive('/', '/space/abc')).toBe(false);
  });

  test('nested tab matches its subtree only', () => {
    expect(isAppTabActive('/profile', '/profile')).toBe(true);
    expect(isAppTabActive('/profile', '/profile/edit')).toBe(true);
    expect(isAppTabActive('/profile', '/profiles')).toBe(false);
    expect(isAppTabActive('/search', '/notifications')).toBe(false);
  });
});
