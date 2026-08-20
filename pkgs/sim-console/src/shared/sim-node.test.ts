import { describe, expect, test } from 'bun:test';

import {
  coerceSimChromeKind,
  coerceSimNodeKind,
  fallbackReportNodes,
  formatSimNodeLabel,
  parseSimNodeAddress,
} from './sim-node';

describe('coerceSimNodeKind', () => {
  test('maps legacy aliases onto World kinds', () => {
    expect(coerceSimNodeKind('server')).toBe('api');
    expect(coerceSimNodeKind('pubsub')).toBe('events');
    expect(coerceSimNodeKind('actor')).toBe('room');
  });

  test('passes through World kinds', () => {
    expect(coerceSimNodeKind('api')).toBe('api');
    expect(coerceSimNodeKind('events')).toBe('events');
    expect(coerceSimNodeKind('client')).toBe('client');
    expect(coerceSimNodeKind('db')).toBe('db');
  });

  test('rejects unknown', () => {
    expect(coerceSimNodeKind('y')).toBeNull();
    expect(coerceSimNodeKind(null)).toBeNull();
  });
});

describe('coerceSimChromeKind', () => {
  test('defaults unknown and db to client', () => {
    expect(coerceSimChromeKind('nope')).toBe('client');
    expect(coerceSimChromeKind('db')).toBe('client');
    expect(coerceSimChromeKind('server')).toBe('api');
  });
});

describe('parseSimNodeAddress / formatSimNodeLabel', () => {
  test('singletons use catalog labels', () => {
    expect(formatSimNodeLabel({ id: 'api', kind: 'api' })).toBe('API');
    expect(formatSimNodeLabel({ id: 'events' })).toBe('Events');
    expect(formatSimNodeLabel({ id: 'server' })).toBe('API');
    expect(formatSimNodeLabel({ id: 'db', kind: 'db' })).toBe('DB');
  });

  test('instances drop the kind prefix', () => {
    expect(formatSimNodeLabel({ id: 'client:alice', kind: 'client' })).toBe(
      'alice'
    );
    expect(formatSimNodeLabel({ id: 'room:lobby', kind: 'room' })).toBe(
      'lobby'
    );
  });

  test('parse coerces address prefix', () => {
    expect(parseSimNodeAddress('client:bob')).toEqual({
      kind: 'client',
      instanceId: 'bob',
    });
    expect(parseSimNodeAddress('api')).toEqual({
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
