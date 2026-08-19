/**
 * One-shot handoff from email create-account to profile bootstrap.
 * `@libs/auth` cannot import `@libs/profile`; ProfileEnsurer takes this.
 */

let pendingSignupUsername: string | null = null;

export function setPendingSignupUsername(username: string): void {
  const next = username.trim();
  pendingSignupUsername = next.length === 0 ? null : next;
}

export function peekPendingSignupUsername(): string | null {
  if (pendingSignupUsername === null || pendingSignupUsername.length === 0) {
    return null;
  }
  return pendingSignupUsername;
}

export function takePendingSignupUsername(): string | null {
  const value = peekPendingSignupUsername();
  pendingSignupUsername = null;
  return value;
}

export function clearPendingSignupUsername(): void {
  pendingSignupUsername = null;
}
