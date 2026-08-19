import { describe, expect, test } from 'bun:test';
import {
  clearPendingSignupUsername,
  peekPendingSignupUsername,
  setPendingSignupUsername,
  takePendingSignupUsername,
} from './pending-signup-username';

describe('pendingSignupUsername', () => {
  test('take clears the stored handle', () => {
    setPendingSignupUsername(' Alice_1 ');
    expect(peekPendingSignupUsername()).toBe('Alice_1');
    expect(takePendingSignupUsername()).toBe('Alice_1');
    expect(takePendingSignupUsername()).toBeNull();
  });

  test('clear drops a pending handle', () => {
    setPendingSignupUsername('alice');
    clearPendingSignupUsername();
    expect(takePendingSignupUsername()).toBeNull();
  });
});
