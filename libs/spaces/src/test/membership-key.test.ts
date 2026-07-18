import { describe, expect, test } from 'bun:test';

import {
  spaceDeviceMembershipEntityId,
  spaceGuestMembershipEntityId,
  spaceMembershipEntityId,
  spaceParticipationEntityId,
} from '../shared/membership-key';

describe('space participation ids', () => {
  test('membership keys by member and space', () => {
    expect(spaceMembershipEntityId('acct-a', 'space-1')).toBe('acct-a:space-1');
  });

  test('participation keys by device and space', () => {
    expect(spaceParticipationEntityId('device-a', 'space-1')).toBe(
      'device-a:space-1'
    );
  });

  test('deprecated aliases match participation helper', () => {
    expect(spaceDeviceMembershipEntityId('d', 's')).toBe(
      spaceParticipationEntityId('d', 's')
    );
    expect(spaceGuestMembershipEntityId('d', 's')).toBe(
      spaceParticipationEntityId('d', 's')
    );
  });
});
