/** One-shot signup handle, scoped to the owning auth client. */
const pendingUsernames = new WeakMap<object, string>();
/** An auth client that wraps another holds the wrapped client's handle. */
const wrappedClients = new WeakMap<object, object>();

function owningClient(client: object): object {
  let owner = client;
  for (
    let inner = wrappedClients.get(owner);
    inner !== undefined;
    inner = wrappedClients.get(owner)
  ) {
    owner = inner;
  }
  return owner;
}

/** `wrapper` decorates `inner`: both name the one signup handle. */
export function sharePendingSignupUsername(
  wrapper: object,
  inner: object
): void {
  wrappedClients.set(wrapper, inner);
}

export function setPendingSignupUsername(
  owner: object,
  username: string
): void {
  const next = username.trim();
  if (next.length === 0) pendingUsernames.delete(owningClient(owner));
  else pendingUsernames.set(owningClient(owner), next);
}

export function peekPendingSignupUsername(
  owner: object,
  externalUserId: string | null
): string | null {
  if (externalUserId === null || externalUserId.length === 0) return null;
  return pendingUsernames.get(owningClient(owner)) ?? null;
}

export function takePendingSignupUsername(owner: object): string | null {
  const client = owningClient(owner);
  const value = pendingUsernames.get(client) ?? null;
  pendingUsernames.delete(client);
  return value;
}

export function clearPendingSignupUsername(owner: object): void {
  pendingUsernames.delete(owningClient(owner));
}
