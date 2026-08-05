import { describe, expect, test } from 'bun:test';

import { latchSwitchChrome } from './latch-switch-chrome';

describe('latchSwitchChrome', () => {
  test('stores non-idle chrome', () => {
    expect(latchSwitchChrome(null, 'loading', null, 'crvouga')).toEqual({
      phase: 'loading',
      error: null,
      pendingDisplayTitle: 'crvouga',
    });
  });

  test('updates through success', () => {
    const loading = latchSwitchChrome(null, 'loading', null, 'crvouga');
    expect(latchSwitchChrome(loading, 'success', null, 'crvouga')).toEqual({
      phase: 'success',
      error: null,
      pendingDisplayTitle: 'crvouga',
    });
  });

  test('keeps prior chrome when phase returns to idle', () => {
    const success = latchSwitchChrome(null, 'success', null, 'crvouga');
    expect(latchSwitchChrome(success, 'idle', null, null)).toEqual(success);
  });

  test('idle with no prior chrome stays null', () => {
    expect(latchSwitchChrome(null, 'idle', null, null)).toBeNull();
  });
});
