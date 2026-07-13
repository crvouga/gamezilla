import { describe, expect, test } from 'bun:test';

import {
  spaceDeviceMembershipEntityId,
  spaceGuestMembershipEntityId,
} from '../shared/membership-key';

describe('spaceDeviceMembershipEntityId', () => {
  test('keys membership by device seat and space', () => {
    expect(spaceDeviceMembershipEntityId('device-a', 'space-1')).toBe(
      'device-a:space-1'
    );
  });

  test('deprecated alias matches device-seat helper', () => {
    expect(spaceGuestMembershipEntityId('d', 's')).toBe(
      spaceDeviceMembershipEntityId('d', 's')
    );
  });
});
