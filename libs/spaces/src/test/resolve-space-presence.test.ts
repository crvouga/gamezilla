import { describe, expect, test } from 'bun:test';

import { resolveSpacePresence } from '../shared/space/resolve-space-presence';

const hostSpaceRow = {
  host_member_id: 'user-1',
  ended_at: null,
};

describe('resolveSpacePresence', () => {
  test('resolves active host when open locally', () => {
    expect(
      resolveSpacePresence({
        spaceEnabled: true,
        spaceLoading: true,
        spaceRow: hostSpaceRow,
        isOpenLocally: true,
        myId: 'user-1',
      })
    ).toEqual({ status: 'active', role: 'host' });
  });

  test('resolves active guest when open locally', () => {
    expect(
      resolveSpacePresence({
        spaceEnabled: true,
        spaceLoading: false,
        spaceRow: { host_member_id: 'other', ended_at: null },
        isOpenLocally: true,
        myId: 'user-2',
      })
    ).toEqual({ status: 'active', role: 'guest' });
  });

  test('resolves join when not open locally even if host fields match', () => {
    expect(
      resolveSpacePresence({
        spaceEnabled: true,
        spaceLoading: false,
        spaceRow: hostSpaceRow,
        isOpenLocally: false,
        myId: 'user-1',
      })
    ).toEqual({ status: 'join', ended: false });
  });

  test('resolves active host via host_account_id when open locally', () => {
    expect(
      resolveSpacePresence({
        spaceEnabled: true,
        spaceLoading: false,
        spaceRow: {
          host_member_id: 'device-old',
          host_account_id: 'user-1',
          ended_at: null,
        },
        isOpenLocally: true,
        myId: 'user-1',
      })
    ).toEqual({ status: 'active', role: 'host' });
  });

  test('resolves active host when ended_at is undefined (omitted NULL)', () => {
    expect(
      resolveSpacePresence({
        spaceEnabled: true,
        spaceLoading: false,
        spaceRow: {
          host_member_id: 'user-1',
          host_account_id: 'user-1',
          ended_at: undefined as unknown as null,
        },
        isOpenLocally: true,
        myId: 'user-1',
      })
    ).toEqual({ status: 'active', role: 'host' });
  });

  test('resolves join when not open for non-host', () => {
    expect(
      resolveSpacePresence({
        spaceEnabled: true,
        spaceLoading: false,
        spaceRow: hostSpaceRow,
        isOpenLocally: false,
        myId: 'user-2',
      })
    ).toEqual({ status: 'join', ended: false });
  });

  test('resolves ended join even when open locally', () => {
    expect(
      resolveSpacePresence({
        spaceEnabled: true,
        spaceLoading: false,
        spaceRow: {
          host_member_id: 'user-1',
          ended_at: '2026-07-13T00:00:00.000Z',
        },
        isOpenLocally: true,
        myId: 'user-1',
      })
    ).toEqual({ status: 'join', ended: true });
  });

  test('loads when space row is missing and query is loading', () => {
    expect(
      resolveSpacePresence({
        spaceEnabled: true,
        spaceLoading: true,
        spaceRow: null,
        isOpenLocally: false,
        myId: 'user-1',
      })
    ).toEqual({ status: 'loading' });
  });
});
