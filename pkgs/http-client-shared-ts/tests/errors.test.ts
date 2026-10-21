import { describe, expect, test } from 'bun:test';

import {
  classifyHttpFetchError,
  isHttpAbortError,
} from '@pkgs/http-client-shared-ts/errors';
import { HttpAbortError } from '@pkgs/http-client-shared-ts/http-abort-error';
import { HttpNetworkError } from '@pkgs/http-client-shared-ts/http-network-error';

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
