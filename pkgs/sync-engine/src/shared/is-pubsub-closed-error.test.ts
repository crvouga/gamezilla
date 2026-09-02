import { describe, expect, spyOn, test } from 'bun:test';
import { PubSubClosedError } from '@pkgs/pubsub/pubsub-closed-error';

import {
  isPubSubClosedError,
  isSqliteClosedError,
  warnPush,
} from './is-pubsub-closed-error';

describe('warnPush', () => {
  test('isPubSubClosedError matches class and name', () => {
    expect(isPubSubClosedError(new PubSubClosedError())).toBe(true);
    const named = new Error('PubSub is closed');
    named.name = 'PubSubClosedError';
    expect(isPubSubClosedError(named)).toBe(true);
    expect(isPubSubClosedError(new Error('boom'))).toBe(false);
  });

  test('isSqliteClosedError matches wrapped dropCacheTables errors', () => {
    const cause = new RangeError('Cannot use a closed database');
    expect(isSqliteClosedError(cause)).toBe(true);
    expect(
      isSqliteClosedError(
        new Error('dropCacheTables: Cannot use a closed database', { cause })
      )
    ).toBe(true);
    expect(isSqliteClosedError(new Error('boom'))).toBe(false);
  });

  test('skips closed-broker noise', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      warnPush(
        '[pubsub] publish failed topic=user:c0',
        new PubSubClosedError()
      );
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  test('still surfaces unexpected errors', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const error = new Error('boom');
      warnPush('[pubsub] publish failed topic=user:c0', error);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });
});
