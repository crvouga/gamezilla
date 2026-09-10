import { describe, expect, test } from 'bun:test';
import { formatSimNodeLabel } from './sim-node';

describe('formatSimNodeLabel', () => {
  test('shortens bare room topic UUIDs', () => {
    const topic = '199f2d72-aaaa-bbbb-cccc-ddddeeee0001';
    expect(formatSimNodeLabel({ id: topic, kind: 'room' })).toBe('199f2d72…');
    expect(formatSimNodeLabel({ id: `room:${topic}` })).toBe('199f2d72…');
  });

  test('keeps kind labels for fixed nodes', () => {
    expect(formatSimNodeLabel({ id: 'server', kind: 'server' })).toBe('Server');
    expect(formatSimNodeLabel({ id: 'events', kind: 'events' })).toBe('PubSub');
  });

  test('shows client instance ids as-is', () => {
    expect(formatSimNodeLabel({ id: 'client-1', kind: 'client' })).toBe(
      'client-1'
    );
    expect(formatSimNodeLabel({ id: 'alice', kind: 'client' })).toBe('alice');
    expect(formatSimNodeLabel({ id: 'client:alice' })).toBe('alice');
  });
});
