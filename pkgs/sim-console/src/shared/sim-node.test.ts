import { describe, expect, test } from 'bun:test';

import {
  coerceSystemChromeKind,
  coerceSystemNodeKind,
  fallbackReportNodes,
  formatSystemNodeLabel,
  parseSystemNodeAddress,
} from './system-node';

describe('coerceSystemNodeKind', () => {
  test('maps legacy aliases onto World kinds', () => {
    expect(coerceSystemNodeKind('server')).toBe('api');
    expect(coerceSystemNodeKind('pubsub')).toBe('events');
    expect(coerceSystemNodeKind('actor')).toBe('room');
  });

  test('passes through World kinds', () => {
    expect(coerceSystemNodeKind('api')).toBe('api');
    expect(coerceSystemNodeKind('events')).toBe('events');
    expect(coerceSystemNodeKind('client')).toBe('client');
    expect(coerceSystemNodeKind('db')).toBe('db');
  });

  test('rejects unknown', () => {
    expect(coerceSystemNodeKind('y')).toBeNull();
    expect(coerceSystemNodeKind(null)).toBeNull();
  });
});

describe('coerceSystemChromeKind', () => {
  test('defaults unknown and db to client', () => {
    expect(coerceSystemChromeKind('nope')).toBe('client');
    expect(coerceSystemChromeKind('db')).toBe('client');
    expect(coerceSystemChromeKind('server')).toBe('api');
  });
});

describe('parseSystemNodeAddress / formatSystemNodeLabel', () => {
  test('singletons use catalog labels', () => {
    expect(formatSystemNodeLabel({ id: 'api', kind: 'api' })).toBe('API');
    expect(formatSystemNodeLabel({ id: 'events' })).toBe('Events');
    expect(formatSystemNodeLabel({ id: 'server' })).toBe('API');
    expect(formatSystemNodeLabel({ id: 'db', kind: 'db' })).toBe('DB');
  });

  test('instances drop the kind prefix', () => {
    expect(formatSystemNodeLabel({ id: 'client:alice', kind: 'client' })).toBe(
      'alice'
    );
    expect(formatSystemNodeLabel({ id: 'room:lobby', kind: 'room' })).toBe(
      'lobby'
    );
  });

  test('parse coerces address prefix', () => {
    expect(parseSystemNodeAddress('client:bob')).toEqual({
      kind: 'client',
      instanceId: 'bob',
    });
    expect(parseSystemNodeAddress('api')).toEqual({
      kind: 'api',
      instanceId: null,
    });
  });
});

describe('fallbackReportNodes', () => {
  test('uses api/events not server/pubsub', () => {
    const nodes = fallbackReportNodes(['client:alice']);
    expect(nodes.map((n) => n.id)).toEqual(['api', 'events', 'client:alice']);
    expect(nodes.map((n) => n.kind)).toEqual(['api', 'events', 'client']);
  });
});
