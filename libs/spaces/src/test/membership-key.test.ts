import { describe, expect, test } from 'bun:test';

import {
  resolveSpaceMemberId,
  spaceMembershipEntityId,
} from '../shared/membership-key';

describe('space membership ids', () => {
  test('member id is the account id', () => {
    expect(resolveSpaceMemberId('acct-a')).toBe('acct-a');
  });

  test('membership keys by member and space', () => {
    expect(spaceMembershipEntityId('acct-a', 'space-1')).toBe('acct-a:space-1');
  });
});
