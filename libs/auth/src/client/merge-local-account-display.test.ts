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
    username: 'provider-name',
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
  });

  test('mid-switch does not paint previous profile onto new active session', () => {
    const display = mergeLocalAccountDisplay({
      session: session({
        sessionId: 's2',
        externalUserId: 'user_2',
        username: 'provider-bob',
        isActive: true,
      }),
      entry: entry({
        accountId: 'acc-2',
        sessionId: 's2',
        externalUserId: 'user_2',
      }),
      activeAccountId: 'acc-1',
      activeProfile: {
        username: 'AliveMackerel790',
        avatar_config: '{"seed":"wrong"}',
      },
    });
    expect(display.username).toBe('provider-bob');
    expect(display.avatarConfigJson).toBeNull();
  });

  test('active bound account uses SQLite profile only', () => {
    const display = mergeLocalAccountDisplay({
      session: session({
        sessionId: 's1',
        isActive: true,
        username: 'provider-name',
      }),
      entry: entry({
        accountId: 'acc-1',
        sessionId: 's1',
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

  test('active bound with empty SQLite profile falls back to session username', () => {
    const display = mergeLocalAccountDisplay({
      session: session({ sessionId: 's1', isActive: true }),
      entry: entry({ accountId: 'acc-1', sessionId: 's1' }),
      activeAccountId: 'acc-1',
      activeProfile: { username: null, avatar_config: null },
    });
    expect(display.username).toBe('provider-name');
    expect(display.avatarConfigJson).toBeNull();
  });

  test('inactive row uses session username and no avatar', () => {
    const display = mergeLocalAccountDisplay({
      session: session({
        sessionId: 's2',
        isActive: false,
        username: 'other-provider',
      }),
      entry: entry({ accountId: 'acc-2', sessionId: 's2' }),
      activeAccountId: 'acc-1',
      activeProfile: {
        username: 'AliveMackerel790',
        avatar_config: '{"seed":"profile"}',
      },
    });
    expect(display.username).toBe('other-provider');
    expect(display.avatarConfigJson).toBeNull();
  });
});
