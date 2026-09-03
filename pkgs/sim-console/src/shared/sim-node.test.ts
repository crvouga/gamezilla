import { describe, expect, test } from 'bun:test';

import {
  coerceSimChromeKind,
  coerceSimNodeKind,
  fallbackReportNodes,
  formatSimNodeLabel,
  parseSimNodeAddress,
} from './sim-node';

describe('coerceSimNodeKind', () => {
  test('maps legacy aliases onto system node kinds', () => {
    expect(coerceSimNodeKind('api')).toBe('server');
    expect(coerceSimNodeKind('pubsub')).toBe('events');
    expect(coerceSimNodeKind('actor')).toBe('room');
  });

  test('passes through system node kinds', () => {
    expect(coerceSimNodeKind('server')).toBe('server');
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
    expect(coerceSimChromeKind('api')).toBe('server');
    expect(coerceSimChromeKind('server')).toBe('server');
  });
});

describe('parseSimNodeAddress / formatSimNodeLabel', () => {
  test('singletons use catalog labels', () => {
    expect(formatSimNodeLabel({ id: 'server', kind: 'server' })).toBe('Server');
    expect(formatSimNodeLabel({ id: 'events' })).toBe('Events');
    expect(formatSimNodeLabel({ id: 'api' })).toBe('Server');
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
      kind: 'server',
      instanceId: null,
    });
    expect(parseSimNodeAddress('server')).toEqual({
      kind: 'server',
      instanceId: null,
    });
  });
});

describe('fallbackReportNodes', () => {
  test('uses server/events not api/pubsub', () => {
    const nodes = fallbackReportNodes(['client:alice']);
    expect(nodes.map((n) => n.id)).toEqual([
      'server',
      'events',
      'client:alice',
    ]);
    expect(nodes.map((n) => n.kind)).toEqual(['server', 'events', 'client']);
  });
});
