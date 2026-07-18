import { describe, expect, test } from 'bun:test';

import { parseSignInPending } from './sign-in-pending';

describe('parseSignInPending', () => {
  test('parses legacy bare ISO as signIn', () => {
    const pending = parseSignInPending(new Date().toISOString());
    expect(pending).not.toBeNull();
    expect(pending?.intent).toBe('signIn');
    expect(pending?.baselineSessionIds).toEqual([]);
  });

  test('parses addAccount payload with baseline sessions', () => {
    const pending = parseSignInPending(
      JSON.stringify({
        startedAt: new Date().toISOString(),
        intent: 'addAccount',
        baselineSessionIds: ['sess_a', 'sess_b'],
      })
    );
    expect(pending?.intent).toBe('addAccount');
    expect(pending?.baselineSessionIds).toEqual(['sess_a', 'sess_b']);
  });

  test('rejects stale markers', () => {
    const stale = new Date(Date.now() - 31 * 60 * 1000).toISOString();
    expect(parseSignInPending(stale)).toBeNull();
  });
});
