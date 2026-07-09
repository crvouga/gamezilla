/** Registered by {@link AuthSyncBridge} once sync-engine is available. */
type IdentityFlushFn = () => Promise<void>;

let identityFlush: IdentityFlushFn | null = null;

export function registerSyncIdentityFlush(fn: IdentityFlushFn): () => void {
  identityFlush = fn;
  return () => {
    if (identityFlush === fn) {
      identityFlush = null;
    }
  };
}

/**
 * Clears anonymous local sync data after sign-in before the user writes again.
 * No-op until sync boot registers a flush handler.
 */
export async function flushSyncIdentityOnSignIn(): Promise<void> {
  if (identityFlush === null) return;
  await identityFlush();
}
