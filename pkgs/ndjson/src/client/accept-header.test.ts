import { describe, expect, test } from 'bun:test';
import { EVENT_STREAM_CONTENT_TYPE } from '../shared/content-type';
import { acceptsEventStream, eventStreamAcceptHeader } from './accept-header';

describe('acceptsEventStream', () => {
  test('matches the canonical content type', () => {
    expect(acceptsEventStream(EVENT_STREAM_CONTENT_TYPE)).toBe(true);
  });

  test('matches when listed with q-values', () => {
    expect(
      acceptsEventStream(`${EVENT_STREAM_CONTENT_TYPE}, application/json;q=0.9`)
    ).toBe(true);
  });

  test('rejects unrelated accept values', () => {
    expect(acceptsEventStream('application/json')).toBe(false);
    expect(acceptsEventStream('application/x-ndjson')).toBe(false);
    expect(acceptsEventStream('')).toBe(false);
    expect(acceptsEventStream(null)).toBe(false);
    expect(acceptsEventStream(undefined)).toBe(false);
  });
});

describe('eventStreamAcceptHeader', () => {
  test('prefers SSE with a json fallback by default', () => {
    expect(eventStreamAcceptHeader()).toBe(
      `${EVENT_STREAM_CONTENT_TYPE}, application/json`
    );
  });

  test('honors a custom fallback', () => {
    expect(eventStreamAcceptHeader('text/plain')).toBe(
      `${EVENT_STREAM_CONTENT_TYPE}, text/plain`
    );
  });
});
