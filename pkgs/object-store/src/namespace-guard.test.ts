import { describe, expect, test } from 'bun:test';
import {
  assertLogicalObjectKey,
  assertRemoteObjectKey,
} from './namespace-guard';
import { ObjectStoreNamespace } from './prefixes';

describe('assertRemoteObjectKey', () => {
  test('accepts keys under gamezilla/', () => {
    expect(() => assertRemoteObjectKey('gamezilla/foo')).not.toThrow();
    expect(() =>
      assertRemoteObjectKey('gamezilla/tts-audio/hash.mp3')
    ).not.toThrow();
  });

  test('rejects keys outside the namespace', () => {
    expect(() => assertRemoteObjectKey('other/foo')).toThrow(
      'must start with "gamezilla/"'
    );
  });

  test('rejects bare namespace without object path', () => {
    expect(() => assertRemoteObjectKey('gamezilla/')).toThrow(
      'must include a path after "gamezilla/"'
    );
    expect(() => assertRemoteObjectKey('gamezilla')).toThrow(
      'must include a path after "gamezilla/"'
    );
  });

  test('rejects empty, absolute, and traversal keys', () => {
    expect(() => assertRemoteObjectKey('')).toThrow('must be non-empty');
    expect(() => assertRemoteObjectKey('/abs')).toThrow(
      'must not start with "/"'
    );
    expect(() => assertRemoteObjectKey('gamezilla/../evil')).toThrow(
      'must not contain ".."'
    );
  });

  test('uses ObjectStoreNamespace.root by default', () => {
    expect(() =>
      assertRemoteObjectKey(`gamezilla/x`, ObjectStoreNamespace.root)
    ).not.toThrow();
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
