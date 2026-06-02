/**
 * Small read helpers over the Better Auth session snapshot returned by
 * `authClient.useSession()`. Shared by {@link AuthBridge} (session reconcile)
 * and the sign-in modal lifecycle (success / error resolution) so both read
 * "signed in" the same way.
 */

import type { SessionSnapshot } from './auth-client-provider';

export function isSnapshotSignedIn(snapshot: SessionSnapshot): boolean {
  return (
    (snapshot.error === null || snapshot.error === undefined) &&
    snapshot.data !== null &&
    snapshot.data !== undefined
  );
}

/** Coerce the snapshot's error field into an `Error`, or `null` when absent. */
export function snapshotError(snapshot: SessionSnapshot): Error | null {
  const err: unknown = snapshot.error;
  if (err === null || err === undefined) return null;
  if (err instanceof Error) return err;
  const message = (err as { message?: unknown }).message;
  return new Error(typeof message === 'string' ? message : String(err));
}
