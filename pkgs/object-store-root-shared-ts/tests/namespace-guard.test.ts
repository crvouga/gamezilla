import { describe, expect, test } from 'bun:test';
import {
  assertLogicalObjectKey,
  assertRemoteObjectKey,
} from '@pkgs/object-store-root-shared-ts/namespace-guard';
import { normalizeObjectStoreRootPrefix } from '@pkgs/object-store-root-shared-ts/prefixes';

const ROOT = normalizeObjectStoreRootPrefix('acme');

describe('assertRemoteObjectKey', () => {
  test('accepts keys under the namespace', () => {
    expect(() => assertRemoteObjectKey('acme/foo', ROOT)).not.toThrow();
    expect(() =>
      assertRemoteObjectKey('acme/tts-audio/hash.mp3', ROOT)
    ).not.toThrow();
  });

  test('rejects keys outside the namespace', () => {
    expect(() => assertRemoteObjectKey('other/foo', ROOT)).toThrow(
      'must start with "acme/"'
    );
  });

  test('rejects bare namespace without object path', () => {
    expect(() => assertRemoteObjectKey('acme/', ROOT)).toThrow(
      'must include a path after "acme/"'
    );
    expect(() => assertRemoteObjectKey('acme', ROOT)).toThrow(
      'must include a path after "acme/"'
    );
  });

  test('rejects empty, absolute, and traversal keys', () => {
    expect(() => assertRemoteObjectKey('', ROOT)).toThrow('must be non-empty');
    expect(() => assertRemoteObjectKey('/abs', ROOT)).toThrow(
      'must not start with "/"'
    );
    expect(() => assertRemoteObjectKey('acme/../evil', ROOT)).toThrow(
      'must not contain ".."'
    );
  });
});

describe('assertLogicalObjectKey', () => {
  test('accepts normal relative keys', () => {
    expect(() => assertLogicalObjectKey('hash.mp3')).not.toThrow();
    expect(() => assertLogicalObjectKey('elevenlabs/abc.mp3')).not.toThrow();
  });

  test('rejects empty, absolute, and traversal keys', () => {
    expect(() => assertLogicalObjectKey('')).toThrow('must be non-empty');
    expect(() => assertLogicalObjectKey('/abs')).toThrow(
      'must not start with "/"'
    );
    expect(() => assertLogicalObjectKey('../evil')).toThrow(
      'must not contain ".."'
    );
  });
});

// regression: object-store-prefix-quadratic-trim
test('a root namespace loses every trailing slash, in linear time', () => {
  for (const slug of ['a', 'acme', 'team-7'])
    for (let slashes = 0; slashes <= 50; slashes += 1)
      expect(
        normalizeObjectStoreRootPrefix(` ${slug}${'/'.repeat(slashes)} `)
      ).toBe(`${slug}/`);
  // CodeQL js/polynomial-redos: a long run of slashes stays cheap.
  const longRun = `a${'/'.repeat(200_000)}x`;
  expect(normalizeObjectStoreRootPrefix(longRun)).toBe(`${longRun}/`);
  expect(() => normalizeObjectStoreRootPrefix('/'.repeat(200_000))).toThrow(
    'Object store root namespace must be non-empty'
  );
});
