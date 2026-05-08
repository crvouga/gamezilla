import { useMyId } from '@gamezilla/client/auth/auth-context';

/**
 * Profile entity id for the current session: account id when signed in,
 * else install device id; `null` when neither is available yet.
 *
 * Atoms that take an optional `profileId` accept this `null` directly and
 * render an empty / fallback state.
 */
export function useMyProfileId(): string | null {
  const id = useMyId();
  return id.length > 0 ? id : null;
}
