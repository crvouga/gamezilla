import { InboxRefusal } from '@libs/notifications-shared/notifications-actions';
import { isHttpAbortError } from '@pkgs/http-client-shared/errors';
import { HttpNetworkError } from '@pkgs/http-client-shared/http-network-error';

/**
 * Why an inbox choice (mark read, mark all read, archive) did not happen:
 * - `connection-missing` — the device could not reach the inbox at all;
 * - `refused` — the inbox answered and said no;
 * - `failed` — the inbox answered without making the change or saying why.
 */
export type InboxChoiceFailure = 'connection-missing' | 'refused' | 'failed';

/**
 * Classifies a failed inbox choice by its outcome. A refusal is never called
 * a missing connection; an unexplained failure is one only while the device
 * is offline.
 */
export function inboxChoiceFailure(
  error: unknown,
  online: boolean
): InboxChoiceFailure {
  if (error instanceof InboxRefusal) return 'refused';
  if (error instanceof HttpNetworkError || isHttpAbortError(error)) {
    return 'connection-missing';
  }
  return online ? 'failed' : 'connection-missing';
}
