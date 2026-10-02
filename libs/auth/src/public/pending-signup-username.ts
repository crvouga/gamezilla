/** One-shot signup handle, scoped to the owning auth client. */
const pendingUsernames = new WeakMap<object, string>();

export function setPendingSignupUsername(
  owner: object,
  username: string
): void {
  const next = username.trim();
  if (next.length === 0) pendingUsernames.delete(owner);
  else pendingUsernames.set(owner, next);
}

export function peekPendingSignupUsername(
  owner: object,
  externalUserId: string | null
): string | null {
  if (externalUserId === null || externalUserId.length === 0) return null;
  return pendingUsernames.get(owner) ?? null;
}

export function takePendingSignupUsername(owner: object): string | null {
  const value = pendingUsernames.get(owner) ?? null;
  pendingUsernames.delete(owner);
  return value;
}

export function clearPendingSignupUsername(owner: object): void {
  pendingUsernames.delete(owner);
}
