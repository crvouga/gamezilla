import { useMyId } from '@libs/auth/client/use-current-user';
import { useMutationClient } from '@libs/auth/client/mutation-client-provider';
import { useEffect, type ReactNode } from 'react';

import {
  applyEnsuredUsername,
  ensureProfile,
} from './ensure-profile-local/ensure-profile';
import { ensureProfileOnline } from './ensure-profile-online/ensure-profile-online';
import { useProfileClientDeps } from './use-profile-client-deps';

/**
 * Profile bootstrap: ensures a local profile row for the current `users.id`,
 * then asks the API to assign a globally unique username if needed.
 */
function ProfileEntityBootstrap(): null {
  const myId = useMyId();
  const mutationClient = useMutationClient();
  const deps = useProfileClientDeps();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (myId.length === 0) return;
        await ensureProfile(mutationClient);
        if (cancelled) return;
        const card = await ensureProfileOnline(deps);
        if (cancelled) return;
        if (card.userId !== myId) {
          return;
        }
        if (card.username.length > 0) {
          await applyEnsuredUsername(mutationClient, card.username);
        }
      } catch {
        // Best-effort: re-asserted on the next identity change.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deps, mutationClient, myId]);

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
