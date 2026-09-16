import { describe, expect, test } from 'bun:test';
import { formatSimNodeLabel } from './sim-node';

describe('formatSimNodeLabel', () => {
  test('shortens bare room topic UUIDs', () => {
    const topic = '199f2d72-aaaa-bbbb-cccc-ddddeeee0001';
    expect(formatSimNodeLabel({ id: topic, kind: 'room' })).toBe('199f2d72…');
    expect(formatSimNodeLabel({ id: `room:${topic}` })).toBe('199f2d72…');
  });

  test('keeps kebab-case kind labels for fixed nodes', () => {
    expect(formatSimNodeLabel({ id: 'server-a', kind: 'server' })).toBe(
      'server-a'
    );
    expect(formatSimNodeLabel({ id: 'events', kind: 'events' })).toBe('pubsub');
    expect(formatSimNodeLabel({ id: 'lb', kind: 'lb' })).toBe('balancer');
  });

  test('shows client instance ids as-is', () => {
    expect(formatSimNodeLabel({ id: 'client-a', kind: 'client' })).toBe(
      'client-a'
    );
    expect(formatSimNodeLabel({ id: 'client:client-b' })).toBe('client-b');
  });
});
