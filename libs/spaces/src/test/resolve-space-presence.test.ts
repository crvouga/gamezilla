import { describe, expect, test } from 'bun:test';

import {
  latchStaleSpacePresence,
  loadingPresence,
  resolveSpacePresence,
} from '../shared/resolve-space-presence';

const hostSpaceRow = {
  host_id: 'user-1',
  ended_at: null,
};

const guestRow = { id: 'membership-1' };

describe('loadingPresence', () => {
  test('does not load when space query is loading but row exists', () => {
    expect(
      loadingPresence({
        spaceEnabled: true,
        spaceLoading: true,
        spaceRow: hostSpaceRow,
        memberEnabled: true,
        guestLoading: false,
        guestRow: null,
        myId: 'user-1',
      })
    ).toBeNull();
  });

  test('loads when space row is missing and query is loading', () => {
    expect(
      loadingPresence({
        spaceEnabled: true,
        spaceLoading: true,
        spaceRow: null,
        memberEnabled: true,
        guestLoading: false,
        guestRow: null,
        myId: 'user-1',
      })
    ).toEqual({ status: 'loading' });
  });

  test('skips guest loading when user is already resolved as host', () => {
    expect(
      loadingPresence({
        spaceEnabled: true,
        spaceLoading: false,
        spaceRow: hostSpaceRow,
        memberEnabled: true,
        guestLoading: true,
        guestRow: null,
        myId: 'user-1',
      })
    ).toBeNull();
  });
});

describe('resolveSpacePresence', () => {
  test('resolves active host while space query reports loading', () => {
    expect(
      resolveSpacePresence({
        spaceEnabled: true,
        spaceLoading: true,
        spaceRow: hostSpaceRow,
        memberEnabled: true,
        guestLoading: false,
        guestRow: null,
        myId: 'user-1',
      })
    ).toEqual({ status: 'active', role: 'host' });
  });

  test('resolves active guest while guest query reports loading', () => {
    expect(
      resolveSpacePresence({
        spaceEnabled: true,
        spaceLoading: false,
        spaceRow: { host_id: 'other', ended_at: null },
        memberEnabled: true,
        guestLoading: true,
        guestRow,
        myId: 'user-2',
      })
    ).toEqual({ status: 'active', role: 'guest' });
  });
});

describe('latchStaleSpacePresence', () => {
  test('returns stale active presence during transient loading', () => {
    const latch = {
      spaceId: 'space-1',
      presence: { status: 'active' as const, role: 'host' as const },
    };
    expect(
      latchStaleSpacePresence('space-1', { status: 'loading' }, latch)
    ).toEqual({
      presence: { status: 'active', role: 'host' },
      latch,
    });
  });

  test('clears latch when space id changes', () => {
    const latch = {
      spaceId: 'space-1',
      presence: { status: 'active' as const, role: 'host' as const },
    };
    expect(
      latchStaleSpacePresence('space-2', { status: 'loading' }, latch)
    ).toEqual({
      presence: { status: 'loading' },
      latch: null,
    });
  });
});
