import { describe, expect, test } from 'bun:test';

import { mapClerkSessions } from './clerk-map-sessions';

describe('mapClerkSessions', () => {
  test('falls back to publicUserData.userId when user is null', () => {
    const mapped = mapClerkSessions([
      {
        id: 'sess_1',
        user: null,
        publicUserData: {
          userId: 'user_1',
          identifier: 'a@example.com',
        },
      },
    ]);
    expect(mapped).toEqual([
      {
        id: 'sess_1',
        userId: 'user_1',
        email: 'a@example.com',
      },
    ]);
  });

  test('prefers user.id over publicUserData', () => {
    const mapped = mapClerkSessions([
      {
        id: 'sess_1',
        user: {
          id: 'user_live',
          primaryEmailAddress: { emailAddress: 'live@example.com' },
        },
        publicUserData: {
          userId: 'user_public',
          identifier: 'public@example.com',
        },
      },
    ]);
    expect(mapped[0]?.userId).toBe('user_live');
    expect(mapped[0]?.email).toBe('live@example.com');
  });
});
