import { describe, expect, test } from 'bun:test';

import { resolveSpaceTitleUsername } from './resolve-space-title-username';

describe('resolveSpaceTitleUsername', () => {
  test('prefers host username', () => {
    expect(
      resolveSpaceTitleUsername({
        hostUsername: 'alice',
        myUsername: 'bob',
        hostProfileId: 'a',
        myId: 'a',
        hostId: 'device',
        myDeviceId: 'device',
      })
    ).toBe('alice');
  });

  test('uses my username when own host and host username empty', () => {
    expect(
      resolveSpaceTitleUsername({
        hostUsername: '',
        myUsername: 'bob',
        hostProfileId: 'a',
        myId: 'a',
        hostId: null,
        myDeviceId: 'device',
      })
    ).toBe('bob');
  });

  test('uses my username when host_id matches this device', () => {
    expect(
      resolveSpaceTitleUsername({
        hostUsername: null,
        myUsername: 'bob',
        hostProfileId: '',
        myId: 'a',
        hostId: 'device',
        myDeviceId: 'device',
      })
    ).toBe('bob');
  });

  test('does not use my username for another host', () => {
    expect(
      resolveSpaceTitleUsername({
        hostUsername: null,
        myUsername: 'bob',
        hostProfileId: 'other',
        myId: 'a',
        hostId: 'other-device',
        myDeviceId: 'device',
      })
    ).toBe(null);
  });
});
