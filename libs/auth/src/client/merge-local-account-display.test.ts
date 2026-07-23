import { describe, expect, test } from 'bun:test';

import type { AccountSession } from '@pkgs/auth/client/account-session';

import type { LocalAccountRosterEntry } from './local-account-roster-types';
import {
  mergeLocalAccountDisplay,
  shouldUseActiveProfile,
} from './merge-local-account-display';

function session(
  partial: Partial<AccountSession> & Pick<AccountSession, 'sessionId'>
): AccountSession {
  return {
    externalUserId: 'user_1',
    email: 'a@example.com',
    username: 'clerk-name',
    isActive: false,
    ...partial,
  };
}

function entry(
  partial: Partial<LocalAccountRosterEntry> &
    Pick<LocalAccountRosterEntry, 'accountId' | 'sessionId'>
): LocalAccountRosterEntry {
  return {
    externalUserId: 'user_1',
    username: null,
    avatarConfigJson: null,
    lastActiveAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('mergeLocalAccountDisplay', () => {
  test('shouldUseActiveProfile requires roster bind to active account', () => {
    expect(shouldUseActiveProfile(undefined, true, 'acc-1')).toBe(false);
    expect(
      shouldUseActiveProfile(
        entry({ accountId: 'acc-2', sessionId: 's1' }),
        true,
        'acc-1'
      )
    ).toBe(false);
    expect(
      shouldUseActiveProfile(
        entry({ accountId: 'acc-1', sessionId: 's1' }),
        true,
        'acc-1'
      )
    ).toBe(true);
    expect(
      shouldUseActiveProfile(
        entry({ accountId: 'acc-1', sessionId: 's1' }),
        false,
        'acc-1'
      )
    ).toBe(false);
  });

  test('mid-switch does not paint previous profile onto new active session', () => {
    const display = mergeLocalAccountDisplay({
      session: session({
        sessionId: 's2',
        externalUserId: 'user_2',
        username: 'clerk-bob',
        isActive: true,
      }),
      // Roster still bound to previous account while lastLocalAccountId lags,
      // or lookup missed — either way, do not use activeProfile for acc-1.
      entry: entry({
        accountId: 'acc-2',
        sessionId: 's2',
        externalUserId: 'user_2',
        username: null,
      }),
      activeAccountId: 'acc-1',
      activeProfile: {
        username: 'AliveMackerel790',
        avatar_config: '{"seed":"wrong"}',
      },
    });
    expect(display.username).toBe('clerk-bob');
    expect(display.avatarConfigJson).toBeNull();
  });

  test('uses live profile when roster account matches', () => {
    const display = mergeLocalAccountDisplay({
      session: session({
        sessionId: 's1',
        isActive: true,
        username: 'clerk-name',
      }),
      entry: entry({
        accountId: 'acc-1',
        sessionId: 's1',
        username: null,
      }),
      activeAccountId: 'acc-1',
      activeProfile: {
        username: 'AliveMackerel790',
        avatar_config: '{"seed":"a"}',
      },
    });
    expect(display.username).toBe('AliveMackerel790');
    expect(display.avatarConfigJson).toBe('{"seed":"a"}');
  });

  test('roster username wins over live profile', () => {
    const display = mergeLocalAccountDisplay({
      session: session({ sessionId: 's1', isActive: true }),
      entry: entry({
        accountId: 'acc-1',
        sessionId: 's1',
        username: 'roster-name',
        avatarConfigJson: '{"seed":"roster"}',
      }),
      activeAccountId: 'acc-1',
      activeProfile: {
        username: 'profile-name',
        avatar_config: '{"seed":"profile"}',
      },
    });
    expect(display.username).toBe('roster-name');
    expect(display.avatarConfigJson).toBe('{"seed":"roster"}');
  });
});
