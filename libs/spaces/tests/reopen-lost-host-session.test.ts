import { describe, expect, test } from 'bun:test';
import { shouldReopenLostHostSession } from '@libs/spaces/public/reopen-lost-host-session';

describe('shouldReopenLostHostSession', () => {
  // regression: journey-host-dumped-onto-own-live-space
  test('reopens when this device lost its session in a space it hosts', () => {
    expect(
      shouldReopenLostHostSession({
        isHost: true,
        sessionDeletedAt: '2026-09-29T23:00:00.000Z',
      })
    ).toBe(true);
  });

  test('leaves the join screen for a device that was never in the space', () => {
    expect(
      shouldReopenLostHostSession({
        isHost: true,
        sessionDeletedAt: undefined,
      })
    ).toBe(false);
    expect(
      shouldReopenLostHostSession({
        isHost: true,
        sessionDeletedAt: null,
      })
    ).toBe(false);
  });

  test('does not reopen a space for someone who does not host it', () => {
    expect(
      shouldReopenLostHostSession({
        isHost: false,
        sessionDeletedAt: '2026-09-29T23:00:00.000Z',
      })
    ).toBe(false);
  });
});
