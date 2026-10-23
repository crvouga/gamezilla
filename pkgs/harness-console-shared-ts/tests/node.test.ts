import { describe, expect, test } from 'bun:test';
import { formatHarnessNodeLabel } from '@pkgs/harness-console-shared-ts/node';

describe('formatHarnessNodeLabel', () => {
  test('shortens bare room topic UUIDs', () => {
    const topic = '199f2d72-aaaa-bbbb-cccc-ddddeeee0001';
    expect(formatHarnessNodeLabel({ id: topic, kind: 'room' })).toBe(
      '199f2d72…'
    );
    expect(formatHarnessNodeLabel({ id: `room:${topic}` })).toBe('199f2d72…');
  });

  test('keeps kebab-case kind labels for fixed nodes', () => {
    expect(formatHarnessNodeLabel({ id: 'server-a', kind: 'server' })).toBe(
      'server-a'
    );
    expect(formatHarnessNodeLabel({ id: 'events', kind: 'events' })).toBe(
      'pubsub'
    );
    expect(formatHarnessNodeLabel({ id: 'lb', kind: 'lb' })).toBe('balancer');
  });

  test('shows client instance ids as-is', () => {
    expect(formatHarnessNodeLabel({ id: 'client-a', kind: 'client' })).toBe(
      'client-a'
    );
    expect(formatHarnessNodeLabel({ id: 'client:client-b' })).toBe('client-b');
  });
});
