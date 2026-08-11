import { describe, expect, test } from 'bun:test';
import {
  buildWebOpfsWipePageUrl,
  sanitizeWebOpfsReturnTo,
} from './opfs-recover-url';

describe('sanitizeWebOpfsReturnTo', () => {
  test('allows same-origin paths', () => {
    expect(sanitizeWebOpfsReturnTo('/')).toBe('/');
    expect(sanitizeWebOpfsReturnTo('/spaces?x=1#y')).toBe('/spaces?x=1#y');
  });

  test('rejects absolute and protocol-relative URLs', () => {
    expect(sanitizeWebOpfsReturnTo('https://evil.example/')).toBe('/');
    expect(sanitizeWebOpfsReturnTo('//evil.example/')).toBe('/');
  });

  test('rejects legacy reset-opfs and wipe infrastructure paths', () => {
    expect(sanitizeWebOpfsReturnTo('/reset-opfs.html')).toBe('/');
    expect(sanitizeWebOpfsReturnTo('/foo?x=reset-opfs')).toBe('/');
    expect(sanitizeWebOpfsReturnTo('/?opfs-wipe=1')).toBe('/');
    expect(sanitizeWebOpfsReturnTo('/x?opfs-wipe=1')).toBe('/');
    expect(sanitizeWebOpfsReturnTo('/sql-workers/opfs-wipe.html')).toBe('/');
  });

  test('defaults undefined / empty', () => {
    expect(sanitizeWebOpfsReturnTo(undefined)).toBe('/');
    expect(sanitizeWebOpfsReturnTo('')).toBe('/');
  });
});

describe('buildWebOpfsWipePageUrl', () => {
  test('builds wipe and park URLs with sanitized return', () => {
    expect(buildWebOpfsWipePageUrl({ returnTo: '/spaces' })).toBe(
      '/sql-workers/opfs-wipe.html?opfs-wipe=1&return=%2Fspaces'
    );
    expect(buildWebOpfsWipePageUrl({ returnTo: '/spaces', parked: true })).toBe(
      '/sql-workers/opfs-wipe.html?opfs-wipe=park&return=%2Fspaces'
    );
    expect(buildWebOpfsWipePageUrl({ returnTo: 'https://evil' })).toBe(
      '/sql-workers/opfs-wipe.html?opfs-wipe=1&return=%2F'
    );
  });
});
