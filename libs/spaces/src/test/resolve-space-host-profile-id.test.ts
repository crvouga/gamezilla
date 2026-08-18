import { describe, expect, test } from 'bun:test';

import { resolveSpaceHostProfileId } from '../shared/space/resolve-space-host-profile-id';

describe('resolveSpaceHostProfileId', () => {
  test('prefers host_member_id', () => {
    expect(resolveSpaceHostProfileId('member-1', 'account-1')).toBe('member-1');
  });

  test('falls back to host_account_id', () => {
    expect(resolveSpaceHostProfileId(null, 'account-1')).toBe('account-1');
    expect(resolveSpaceHostProfileId('', 'account-1')).toBe('account-1');
  });

  test('returns null when both missing', () => {
    expect(resolveSpaceHostProfileId(null, null)).toBe(null);
    expect(resolveSpaceHostProfileId('', '')).toBe(null);
  });
});
