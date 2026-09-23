import { containsBlockedTerm } from '@pkgs/word-filter';

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 32;
// export const USERNAME_CHANGE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const USERNAME_CHANGE_COOLDOWN_MS = 1000; // 1 second

const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

export type UsernameValidationError =
  | 'empty'
  | 'too_short'
  | 'too_long'
  | 'invalid_format'
  | 'blocked';

export function normalizeUsername(raw: string): string {
  return raw.trim();
}

export function validateUsername(raw: string): UsernameValidationError | null {
  const username = normalizeUsername(raw);
  if (username.length === 0) return 'empty';
  if (username.length < USERNAME_MIN_LENGTH) return 'too_short';
  if (username.length > USERNAME_MAX_LENGTH) return 'too_long';
  if (!USERNAME_PATTERN.test(username)) return 'invalid_format';
  if (containsBlockedTerm(username)) return 'blocked';
  return null;
}
export function canChangeUsername(
  usernameChangedAt: string | null | undefined,
  nowMs: number
): boolean {
  if (usernameChangedAt === null || usernameChangedAt === undefined)
    return true;
  if (usernameChangedAt.length === 0) return true;
  const changedAtMs = Date.parse(usernameChangedAt);
  if (!Number.isFinite(changedAtMs)) return true;
  return nowMs - changedAtMs >= USERNAME_CHANGE_COOLDOWN_MS;
}
