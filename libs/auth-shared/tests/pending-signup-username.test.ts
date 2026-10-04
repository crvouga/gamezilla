import { describe, expect, test } from 'bun:test';
import {
  clearPendingSignupUsername,
  peekPendingSignupUsername,
  setPendingSignupUsername,
  takePendingSignupUsername,
} from '@libs/auth-shared/pending-signup-username';

describe('pendingSignupUsername', () => {
  const owner = {};
  test('concurrent devices retain their own signup names', () => {
    // regression: signup-username-cross-device
    const alice = {};
    const bob = {};
    setPendingSignupUsername(alice, 'alice');
    setPendingSignupUsername(bob, 'bob');
    expect(takePendingSignupUsername(alice)).toBe('alice');
    expect(takePendingSignupUsername(bob)).toBe('bob');
    expect(takePendingSignupUsername(alice)).toBeNull();
  });

  test('a handle waits until the account is ready', () => {
    // regression: signup-username-before-account-ready
    const client = {};
    setPendingSignupUsername(client, 'alice');
    expect(peekPendingSignupUsername(client, null)).toBeNull();
    expect(peekPendingSignupUsername(client, 'verified-alice')).toBe('alice');
    expect(takePendingSignupUsername(client)).toBe('alice');
  });

  test('take clears the stored handle', () => {
    setPendingSignupUsername(owner, ' Alice_1 ');
    expect(peekPendingSignupUsername(owner, 'verified-owner')).toBe('Alice_1');
    expect(takePendingSignupUsername(owner)).toBe('Alice_1');
    expect(takePendingSignupUsername(owner)).toBeNull();
  });

  test('clear drops a pending handle', () => {
    setPendingSignupUsername(owner, 'alice');
    clearPendingSignupUsername(owner);
    expect(takePendingSignupUsername(owner)).toBeNull();
  });
});
