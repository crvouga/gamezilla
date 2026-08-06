import { useMyId } from '@libs/auth/client/use-current-user';
import { useRulesAuth } from '@libs/auth/client/use-rules-auth';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
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
  const engine = useSyncEngine();
  const myId = useMyId();
  const auth = useRulesAuth();
  const deps = useProfileClientDeps();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (myId.length === 0) return;
        await ensureProfile(engine.db, auth, myId);
        if (cancelled) return;
        const card = await ensureProfileOnline(deps);
        if (cancelled) return;
        if (card.userId !== myId) {
          return;
        }
        if (card.username.length > 0) {
          await applyEnsuredUsername(engine.db, auth, {
            profileId: myId,
            username: card.username,
          });
        }
      } catch {
        // Best-effort: re-asserted on the next identity change.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth, deps, engine, myId]);

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
