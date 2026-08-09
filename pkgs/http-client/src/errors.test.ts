import { describe, expect, test } from 'bun:test';

import {
  classifyHttpFetchError,
  HttpAbortError,
  HttpNetworkError,
  isHttpAbortError,
} from './errors';

describe('http-client errors', () => {
  test('classifies AbortError as HttpAbortError', () => {
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    const classified = classifyHttpFetchError(abort);
    expect(classified).toBeInstanceOf(HttpAbortError);
    expect(isHttpAbortError(classified)).toBe(true);
  });

  test('classifies other throws as HttpNetworkError', () => {
    const classified = classifyHttpFetchError(new TypeError('Failed to fetch'));
    expect(classified).toBeInstanceOf(HttpNetworkError);
    expect(classified.message).toBe('Failed to fetch');
  });
});
