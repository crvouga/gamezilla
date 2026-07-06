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
    expect(parseObservabilityBackend('local-file')).toBe('local-file');
    expect(parseObservabilityBackend('logger')).toBe('logger');
    expect(parseObservabilityBackend('sentry')).toBe('sentry');
    expect(parseObservabilityBackend('SENTRY')).toBe('sentry');
  });

  test('unknown values fall back to noop', () => {
    expect(parseObservabilityBackend('unknown')).toBe('noop');
  });
});

describe('resolveObservabilityBackend', () => {
  test('defaults to local-file in dev', () => {
    expect(
      resolveObservabilityBackend({
        envBackend: undefined,
        isProduction: false,
      })
    ).toBe('local-file');
  });

  test('defaults to logger in prod', () => {
    expect(
      resolveObservabilityBackend({
        envBackend: undefined,
        isProduction: true,
      })
    ).toBe('logger');
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
    ).toBe('sentry');
    expect(
      resolveObservabilityBackend({
        envBackend: 'logger',
        isProduction: false,
      })
    ).toBe('logger');
  });

  test('forceNoop overrides defaults and explicit backend', () => {
    expect(
      resolveObservabilityBackend({
        envBackend: 'sentry',
        forceNoop: true,
        isProduction: true,
      })
    ).toBe('noop');
  });
});
