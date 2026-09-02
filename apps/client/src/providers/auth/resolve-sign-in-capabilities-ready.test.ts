import { describe, expect, test } from 'bun:test';
import { resolveSignInCapabilitiesReady } from './resolve-sign-in-capabilities-ready';

describe('resolveSignInCapabilitiesReady', () => {
  test('stays not-ready while loading', () => {
    expect(
      resolveSignInCapabilitiesReady({
        isLoading: true,
        methodsKnown: false,
        configRowCount: 0,
      })
    ).toBe(false);
  });

  test('empty hydrated SQLite is not ready (avoids false no-methods modal)', () => {
    expect(
      resolveSignInCapabilitiesReady({
        isLoading: false,
        methodsKnown: false,
        configRowCount: 0,
      })
    ).toBe(false);
  });

  test('unlocks when a method flag is known', () => {
    expect(
      resolveSignInCapabilitiesReady({
        isLoading: false,
        methodsKnown: true,
        configRowCount: 0,
      })
    ).toBe(true);
  });

  test('unlocks when client_config rows hydrated (definitive disabled)', () => {
    expect(
      resolveSignInCapabilitiesReady({
        isLoading: false,
        methodsKnown: false,
        configRowCount: 2,
      })
    ).toBe(true);
  });
});
