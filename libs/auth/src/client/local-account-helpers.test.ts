import { describe, expect, test } from 'bun:test';

import {
  findActiveLocalAccount,
  localAccountAccessibilityLabel,
  localAccountSubtitle,
} from './local-account-helpers';
import type { LocalAccount } from './use-local-accounts';

function account(
  partial: Partial<LocalAccount> & Pick<LocalAccount, 'sessionId'>
): LocalAccount {
  return {
    accountId: null,
    externalUserId: 'ext',
    email: null,
    username: null,
    avatarConfigJson: null,
    isActive: false,
    lastActiveAt: null,
    ...partial,
  };
}

describe('localAccountSubtitle', () => {
  test('returns email when present', () => {
    expect(
      localAccountSubtitle(account({ sessionId: 's', email: 'a@b.com' }))
    ).toBe('a@b.com');
  });

  test('omits empty email', () => {
    expect(localAccountSubtitle(account({ sessionId: 's', email: '' }))).toBe(
      undefined
    );
  });
});

describe('localAccountAccessibilityLabel', () => {
  test('title only', () => {
    expect(String(localAccountAccessibilityLabel('chris', undefined))).toBe(
      'chris'
    );
  });

  test('title with subtitle', () => {
    expect(String(localAccountAccessibilityLabel('chris', 'a@b.com'))).toBe(
      'chris, a@b.com'
    );
  });
});

describe('findActiveLocalAccount', () => {
  test('returns active account', () => {
    const accounts = [
      account({ sessionId: 'a', isActive: false }),
      account({ sessionId: 'b', isActive: true, username: 'me' }),
    ];
    expect(findActiveLocalAccount(accounts)?.sessionId).toBe('b');
  });
});
