import { expect, test } from 'bun:test';
import glob from '@pkgs/glob-match';
import { assertProperty, fc } from '@pkgs/property';

test('catalog locales are captured and source exclusions match braces and globstars', () => {
  expect(
    glob.capture('libs/locales/*/messages.po', 'libs/locales/en/messages.po')
  ).toEqual(['en']);
  expect(
    glob.capture('libs/locales/*/messages.po', 'libs/messages.po')
  ).toBeNull();
  expect(
    glob.any('libs/foo/tests/example.test.ts', ['**/tests/**', '**/*.{js,ts}'])
  ).toBe(true);
  expect(glob.any('libs/foo/source.ts', ['**/tests/**'])).toBe(false);
  expect(
    glob
      .makeRe('**/.cache/**', { dot: true, lookbehinds: false })
      .test('libs/foo/.cache/a')
  ).toBe(true);
});

test('glob compilation rejects the advisory input before recursion or regex compilation', () => {
  // regression: build-glob-nested-braces
  const pattern = '{'.repeat(12000) + 'a,b' + '}'.repeat(12000);
  expect(() => glob.any('a', pattern)).toThrow(
    'Glob nesting exceeds 64 levels'
  );
  expect(() => glob.makeRe(pattern)).toThrow('Glob nesting exceeds 64 levels');
  expect(() => glob.capture(pattern, 'a')).toThrow(
    'Glob nesting exceeds 64 levels'
  );
});

test('catalog capture preserves every generated locale', () => {
  assertProperty(
    'catalog capture',
    fc.property(fc.stringMatching(/^[a-z]{2,8}$/), (locale) => {
      expect(
        glob.capture('locales/*/messages.po', `locales/${locale}/messages.po`)
      ).toEqual([locale]);
      expect(
        glob.any(`locales/${locale}/messages.po`, 'locales/*/messages.po')
      ).toBe(true);
    })
  );
});

test('all excessive nesting depths fail with a bounded validation error', () => {
  assertProperty(
    'bounded glob nesting',
    fc.property(fc.integer({ min: 65, max: 15000 }), (depth) => {
      expect(() =>
        glob.makeRe('{'.repeat(depth) + 'a,b' + '}'.repeat(depth))
      ).toThrow(TypeError);
    })
  );
});
