import { describe, expect, test } from 'bun:test';

import {
  parseObservabilityBackend,
  resolveObservabilityBackend,
} from './backend';

describe('parseObservabilityBackend', () => {
  test('returns null when unset', () => {
    expect(parseObservabilityBackend(undefined)).toBeNull();
    expect(parseObservabilityBackend(null)).toBeNull();
    expect(parseObservabilityBackend('')).toBeNull();
    expect(parseObservabilityBackend('   ')).toBeNull();
  });

  test('parses explicit backends', () => {
    expect(parseObservabilityBackend('noop')).toBe('noop');
    expect(parseObservabilityBackend('none')).toBe('noop');
    expect(parseObservabilityBackend('local-file')).toBe('local-file');
    expect(parseObservabilityBackend('logger')).toBe('logger');
    expect(parseObservabilityBackend('console')).toBe('logger');
  });

  test('unknown and legacy sentry values fall back to noop', () => {
    expect(parseObservabilityBackend('unknown')).toBe('noop');
    expect(parseObservabilityBackend('sentry')).toBe('noop');
    expect(parseObservabilityBackend('SENTRY')).toBe('noop');
  });
});

describe('resolveObservabilityBackend', () => {
  test('defaults to noop when unset', () => {
    expect(
      resolveObservabilityBackend({
        envBackend: undefined,
        isProduction: false,
      })
    ).toBe('noop');
    expect(
      resolveObservabilityBackend({
        envBackend: undefined,
        isProduction: true,
      })
    ).toBe('noop');
  });

  test('honors explicit backends', () => {
    expect(
      resolveObservabilityBackend({
        envBackend: 'noop',
        isProduction: true,
      })
    ).toBe('noop');
    expect(
      resolveObservabilityBackend({
        envBackend: 'sentry',
        isProduction: false,
      })
    ).toBe('noop');
    expect(
      resolveObservabilityBackend({
        envBackend: 'logger',
        isProduction: false,
      })
    ).toBe('logger');
    expect(
      resolveObservabilityBackend({
        envBackend: 'console',
        isProduction: false,
      })
    ).toBe('logger');
  });

  test('forceNoop overrides defaults and explicit backend', () => {
    expect(
      resolveObservabilityBackend({
        envBackend: 'logger',
        forceNoop: true,
        isProduction: true,
      })
    ).toBe('noop');
  });
});
