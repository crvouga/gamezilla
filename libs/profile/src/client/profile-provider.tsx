import { useMutationClient } from '@libs/auth/client/mutation-client-provider';
import { useMyId } from '@libs/auth/client/use-current-user';
import { type ReactNode, useEffect } from 'react';

import { ensureProfile } from './ensure-profile-local/ensure-profile';

/**
 * Profile bootstrap: ensures a local profile row (with auto username) for the
 * current `users.id`. Upload via `/api/mutations` assigns uniqueness on
 * Postgres.
 */
function ProfileEntityBootstrap(): null {
  const myId = useMyId();
  const mutationClient = useMutationClient();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (myId.length === 0) return;
        await ensureProfile(mutationClient);
        if (cancelled) return;
      } catch {
        // Best-effort: re-asserted on the next identity change.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mutationClient, myId]);

  return null;
}

/**
 * Mounts {@link ProfileEntityBootstrap}. Reacts to identity changes via
 * {@link useMyId}.
 */
export function ProfileProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <>
      <ProfileEntityBootstrap />
      {children}
    </>
  );
}
