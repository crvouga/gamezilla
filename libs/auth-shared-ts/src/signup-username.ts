/**
 * Client-side create-account username rules.
 * Keep in sync with `libs/profile-shared-ts/src/username.ts`.
 */

import type { AppModeration } from '@libs/moderation-shared-ts/policy';

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 32;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

export function isValidSignupUsername(
  raw: string,
  moderation: AppModeration
): boolean {
  const username = raw.trim();
  if (username.length < USERNAME_MIN_LENGTH) return false;
  if (username.length > USERNAME_MAX_LENGTH) return false;
  if (!USERNAME_PATTERN.test(username)) return false;
  return moderation.checkWrite('username', username).allowed;
}
