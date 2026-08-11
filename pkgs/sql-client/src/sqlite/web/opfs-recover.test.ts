import { describe, expect, test } from 'bun:test';
import { sanitizeWebOpfsReturnTo } from './opfs-recover-url';

describe('sanitizeWebOpfsReturnTo', () => {
  test('allows same-origin paths', () => {
    expect(sanitizeWebOpfsReturnTo('/')).toBe('/');
    expect(sanitizeWebOpfsReturnTo('/spaces?x=1#y')).toBe('/spaces?x=1#y');
  });

  test('rejects absolute and protocol-relative URLs', () => {
    expect(sanitizeWebOpfsReturnTo('https://evil.example/')).toBe('/');
    expect(sanitizeWebOpfsReturnTo('//evil.example/')).toBe('/');
  });

  test('rejects legacy reset-opfs park paths', () => {
    expect(sanitizeWebOpfsReturnTo('/reset-opfs.html')).toBe('/');
    expect(sanitizeWebOpfsReturnTo('/foo?x=reset-opfs')).toBe('/');
  });

  test('defaults undefined / empty', () => {
    expect(sanitizeWebOpfsReturnTo(undefined)).toBe('/');
    expect(sanitizeWebOpfsReturnTo('')).toBe('/');
  });
});
