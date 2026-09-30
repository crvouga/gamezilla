import { describe, expect, test } from 'bun:test';
import { shouldEnterOwnLiveSpace } from '@libs/spaces/public/reopen-lost-host-session';

describe('shouldEnterOwnLiveSpace', () => {
  // regression: journey-host-dumped-onto-own-live-space
  // regression: journey-host-stuck-on-own-join
  test('takes a host into their own live space, even on a device with no session', () => {
    expect(shouldEnterOwnLiveSpace({ isHost: true, spaceEnded: false })).toBe(
      true
    );
  });

  test('does not reopen a space that has ended', () => {
    expect(shouldEnterOwnLiveSpace({ isHost: true, spaceEnded: true })).toBe(
      false
    );
  });

  test('does not enter a space for someone who does not host it', () => {
    expect(shouldEnterOwnLiveSpace({ isHost: false, spaceEnded: false })).toBe(
      false
    );
  });
});
