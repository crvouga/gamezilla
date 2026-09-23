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
  });

  test('unknown values fall back to noop', () => {
    expect(parseObservabilityBackend('unknown')).toBe('noop');
  });
});

describe('resolveObservabilityBackend', () => {
  test('defaults to noop when unset', () => {
    expect(resolveObservabilityBackend(undefined)).toBe('noop');
    expect(resolveObservabilityBackend(null)).toBe('noop');
  });

  test('honors explicit backends', () => {
    expect(resolveObservabilityBackend('noop')).toBe('noop');
    expect(resolveObservabilityBackend('unexpected')).toBe('noop');
    expect(resolveObservabilityBackend('logger')).toBe('logger');
  });
});
