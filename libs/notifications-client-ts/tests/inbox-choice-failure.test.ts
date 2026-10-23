import { describe, expect, test } from 'bun:test';
import { inboxChoiceFailure } from '@libs/notifications-client-ts/inbox-choice-failure';
import { InboxRefusal } from '@libs/notifications-shared-ts/notifications-actions';
import { HttpNetworkError } from '@pkgs/http-client-shared-ts/http-network-error';

describe('why an inbox choice did not happen', () => {
  // regression: notifications-refusal-called-connection-missing
  test('the inbox saying no is a refusal, not a missing connection', () => {
    const refusal = new InboxRefusal(404, 'Notification not found');
    expect(inboxChoiceFailure(refusal, true)).toBe('refused');
    expect(inboxChoiceFailure(refusal, false)).toBe('refused');
  });

  test('not reaching the inbox is a missing connection', () => {
    const unreachable = new HttpNetworkError(
      'The connection is currently unavailable.'
    );
    expect(inboxChoiceFailure(unreachable, true)).toBe('connection-missing');
    expect(inboxChoiceFailure(unreachable, false)).toBe('connection-missing');
  });

  test('an unexplained failure is a missing connection only while offline', () => {
    const unexplained = new Error('Notifications API /read failed: 500');
    expect(inboxChoiceFailure(unexplained, true)).toBe('failed');
    expect(inboxChoiceFailure(unexplained, false)).toBe('connection-missing');
  });
});
