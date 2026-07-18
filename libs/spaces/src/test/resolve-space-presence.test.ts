import { describe, expect, test } from 'bun:test';

import {
  latchStaleSpacePresence,
  loadingPresence,
  resolveSpacePresence,
} from '../shared/resolve-space-presence';

const hostSpaceRow = {
  host_member_id: 'user-1',
  ended_at: null,
};

const guestRow = { id: 'participation-1' };

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

  test('loads while membership query is pending', () => {
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
    ).toEqual({ status: 'loading' });
  });
});

describe('resolveSpacePresence', () => {
  test('resolves active host from participation + host_member_id', () => {
    expect(
      resolveSpacePresence({
        spaceEnabled: true,
        spaceLoading: true,
        spaceRow: hostSpaceRow,
        memberEnabled: true,
        guestLoading: false,
        guestRow,
        myId: 'user-1',
      })
    ).toEqual({ status: 'active', role: 'host' });
  });

  test('resolves active guest while participation row is present', () => {
    expect(
      resolveSpacePresence({
        spaceEnabled: true,
        spaceLoading: false,
        spaceRow: { host_member_id: 'other', ended_at: null },
        memberEnabled: true,
        guestLoading: true,
        guestRow,
        myId: 'user-2',
      })
    ).toEqual({ status: 'active', role: 'guest' });
  });

  test('resolves join when participation is missing even for host match', () => {
    expect(
      resolveSpacePresence({
        spaceEnabled: true,
        spaceLoading: false,
        spaceRow: hostSpaceRow,
        memberEnabled: true,
        guestLoading: false,
        guestRow: null,
        myId: 'user-1',
      })
    ).toEqual({ status: 'join', ended: false });
  });

  test('resolves ended join even when participation row is still present', () => {
    expect(
      resolveSpacePresence({
        spaceEnabled: true,
        spaceLoading: false,
        spaceRow: {
          host_member_id: 'user-1',
          ended_at: '2026-07-13T00:00:00.000Z',
        },
        memberEnabled: true,
        guestLoading: false,
        guestRow,
        myId: 'user-1',
      })
    ).toEqual({ status: 'join', ended: true });
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

  test('holds active across transient join after membership blip', () => {
    const latch = {
      spaceId: 'space-1',
      presence: { status: 'active' as const, role: 'host' as const },
    };
    expect(
      latchStaleSpacePresence(
        'space-1',
        { status: 'join', ended: false },
        latch
      )
    ).toEqual({
      presence: { status: 'active', role: 'host' },
      latch,
    });
  });

  test('accepts ended join even when previously active', () => {
    const latch = {
      spaceId: 'space-1',
      presence: { status: 'active' as const, role: 'host' as const },
    };
    expect(
      latchStaleSpacePresence('space-1', { status: 'join', ended: true }, latch)
    ).toEqual({
      presence: { status: 'join', ended: true },
      latch: {
        spaceId: 'space-1',
        presence: { status: 'join', ended: true },
      },
    });
  });
});
