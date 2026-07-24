import { describe, expect, test } from 'bun:test';

import {
  detachedRosterSessionId,
  findRosterEntryForSession,
  removeRosterAccount,
  removeRosterSession,
  touchRosterAccount,
  trimRosterToSessions,
  upsertRosterEntry,
} from './local-account-roster';
import type { LocalAccountRosterEntry } from './local-account-roster-types';

function entry(
  partial: Partial<LocalAccountRosterEntry> &
    Pick<LocalAccountRosterEntry, 'accountId' | 'sessionId'>
): LocalAccountRosterEntry {
  return {
    externalUserId: null,
    lastActiveAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('local-account-roster', () => {
  test('upsertRosterEntry replaces same account and session', () => {
    const prev = [
      entry({ accountId: 'a1', sessionId: 's1' }),
      entry({ accountId: 'a2', sessionId: 's2' }),
    ];
    const next = upsertRosterEntry(
      prev,
      entry({ accountId: 'a1', sessionId: 's1' })
    );
    expect(next).toHaveLength(2);
    expect(next[0]?.accountId).toBe('a1');
  });

  test('upsertRosterEntry detaches other account on session collision', () => {
    const prev = [
      entry({
        accountId: 'a1',
        sessionId: 's1',
        externalUserId: 'user_1',
      }),
      entry({
        accountId: 'a2',
        sessionId: 's2',
        externalUserId: 'user_2',
      }),
    ];
    const next = upsertRosterEntry(
      prev,
      entry({
        accountId: 'a2',
        sessionId: 's1',
        externalUserId: 'user_2',
      })
    );
    expect(next).toHaveLength(2);
    expect(next[0]?.accountId).toBe('a2');
    expect(next[0]?.sessionId).toBe('s1');
    expect(next[1]?.accountId).toBe('a1');
    expect(next[1]?.sessionId).toBe(detachedRosterSessionId('a1'));
  });

  test('findRosterEntryForSession ignores session bind with wrong external user', () => {
    const prev = [
      entry({
        accountId: 'a2',
        sessionId: 's1',
        externalUserId: 'user_2',
      }),
      entry({
        accountId: 'a1',
        sessionId: detachedRosterSessionId('a1'),
        externalUserId: 'user_1',
      }),
    ];
    const forUser1 = findRosterEntryForSession(prev, {
      sessionId: 's1',
      externalUserId: 'user_1',
    });
    expect(forUser1?.accountId).toBe('a1');

    const forUser2 = findRosterEntryForSession(prev, {
      sessionId: 's1',
      externalUserId: 'user_2',
    });
    expect(forUser2?.accountId).toBe('a2');
  });

  test('touchRosterAccount updates binding without display fields', () => {
    const prev = [
      entry({
        accountId: 'a1',
        sessionId: 's1',
        externalUserId: 'user_1',
      }),
    ];
    const next = touchRosterAccount({
      roster: prev,
      accountId: 'a1',
      sessionId: 's9',
      nowIso: '2026-07-01T00:00:00.000Z',
    });
    expect(next[0]?.externalUserId).toBe('user_1');
    expect(next[0]?.sessionId).toBe('s9');
    expect(next[0]?.lastActiveAt).toBe('2026-07-01T00:00:00.000Z');
  });

  test('findRosterEntryForSession matches by externalUserId after session rotation', () => {
    const prev = [
      entry({
        accountId: 'a1',
        sessionId: 's_old',
        externalUserId: 'user_1',
      }),
    ];
    const found = findRosterEntryForSession(prev, {
      sessionId: 's_new',
      externalUserId: 'user_1',
    });
    expect(found?.accountId).toBe('a1');
  });

  test('trimRosterToSessions drops unknown sessions', () => {
    const prev = [
      entry({ accountId: 'a1', sessionId: 's1' }),
      entry({ accountId: 'a2', sessionId: 's2' }),
    ];
    const next = trimRosterToSessions(prev, new Set(['s2']));
    expect(next.map((row) => row.sessionId)).toEqual(['s2']);
  });

  test('remove helpers', () => {
    const prev = [
      entry({ accountId: 'a1', sessionId: 's1' }),
      entry({ accountId: 'a2', sessionId: 's2' }),
    ];
    expect(removeRosterAccount(prev, 'a1')).toHaveLength(1);
    expect(removeRosterSession(prev, 's2')).toHaveLength(1);
  });
});
