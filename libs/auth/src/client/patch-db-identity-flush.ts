/** Registered by {@link AuthPatchDbBridge} once patch-db sync is available. */
type IdentityFlushFn = (deviceId: string) => Promise<void>;

let identityFlush: IdentityFlushFn | null = null;

export function registerPatchDbIdentityFlush(fn: IdentityFlushFn): () => void {
  identityFlush = fn;
  return () => {
    if (identityFlush === fn) {
      identityFlush = null;
    }
  };
}

/**
 * Drops anonymous outbox rows after sign-in before the user can write again.
 * No-op until patch-db boot registers a flush handler.
 */
export async function flushPatchDbIdentityOnSignIn(
  deviceId: string
): Promise<void> {
  if (identityFlush === null) return;
  await identityFlush(deviceId);
}
