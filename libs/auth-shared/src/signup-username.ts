/**
 * Client-side create-account username rules.
 * Keep in sync with `libs/profile-shared/src/username.ts`.
 */

import { containsBlockedTerm } from '@pkgs/word-filter-shared/match';

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 32;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

export function isValidSignupUsername(raw: string): boolean {
  const username = raw.trim();
  if (username.length < USERNAME_MIN_LENGTH) return false;
  if (username.length > USERNAME_MAX_LENGTH) return false;
  if (!USERNAME_PATTERN.test(username)) return false;
  return !containsBlockedTerm(username);
}
