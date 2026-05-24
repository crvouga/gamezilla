import { describe, expect, test } from 'bun:test';
import { NDJSON_CONTENT_TYPE } from '../shared/content-type';
import { acceptsNdjson, ndjsonAcceptHeader } from './accept-header';

describe('acceptsNdjson', () => {
  test('detects exact match', () => {
    expect(acceptsNdjson(NDJSON_CONTENT_TYPE)).toBe(true);
  });

  test('detects ndjson alongside other types', () => {
    expect(
      acceptsNdjson(`${NDJSON_CONTENT_TYPE}, application/json;q=0.9`)
    ).toBe(true);
  });

  test('rejects when ndjson is absent', () => {
    expect(acceptsNdjson('application/json')).toBe(false);
    expect(acceptsNdjson('')).toBe(false);
    expect(acceptsNdjson(null)).toBe(false);
    expect(acceptsNdjson(undefined)).toBe(false);
  });
});

describe('ndjsonAcceptHeader', () => {
  test('prefers ndjson with a default fallback to flat JSON', () => {
    expect(ndjsonAcceptHeader()).toBe(
      `${NDJSON_CONTENT_TYPE}, application/json`
    );
  });

  test('honors a custom fallback', () => {
    expect(ndjsonAcceptHeader('text/plain')).toBe(
      `${NDJSON_CONTENT_TYPE}, text/plain`
    );
  });
});
