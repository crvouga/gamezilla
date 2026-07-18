import { describe, expect, test } from 'bun:test';

import {
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
    username: null,
    avatarConfigJson: null,
    lastActiveAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('local-account-roster', () => {
  test('upsertRosterEntry replaces same account and session', () => {
    const prev = [
      entry({ accountId: 'a1', sessionId: 's1', username: 'old' }),
      entry({ accountId: 'a2', sessionId: 's2' }),
    ];
    const next = upsertRosterEntry(
      prev,
      entry({ accountId: 'a1', sessionId: 's1', username: 'new' })
    );
    expect(next).toHaveLength(2);
    expect(next[0]?.username).toBe('new');
    expect(next[0]?.accountId).toBe('a1');
  });

  test('touchRosterAccount preserves display fields when omitted', () => {
    const prev = [
      entry({
        accountId: 'a1',
        sessionId: 's1',
        username: 'keep',
        avatarConfigJson: '{"style":"funEmoji"}',
      }),
    ];
    const next = touchRosterAccount({
      roster: prev,
      accountId: 'a1',
      sessionId: 's9',
      nowIso: '2026-07-01T00:00:00.000Z',
    });
    expect(next[0]?.username).toBe('keep');
    expect(next[0]?.avatarConfigJson).toBe('{"style":"funEmoji"}');
    expect(next[0]?.sessionId).toBe('s9');
    expect(next[0]?.lastActiveAt).toBe('2026-07-01T00:00:00.000Z');
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
