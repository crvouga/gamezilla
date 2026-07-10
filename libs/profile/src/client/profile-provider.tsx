import { useMyId } from '@libs/auth/client/use-current-user';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { useEffect, type ReactNode } from 'react';

import { ensureProfile } from './ensure-profile-entity';

/**
 * Profile bootstrap: ensures a profile row exists for the current replication
 * identity (install id when anonymous, account id when signed in). Waits for
 * the first sync download so a new web tab does not mint a fresh random
 * profile before the server row arrives.
 */
function ProfileEntityBootstrap(): null {
  const engine = useSyncEngine();
  const myId = useMyId();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (myId.length === 0) return;
        await engine.waitForFirstSync();
        if (cancelled) return;
        await ensureProfile(engine.db, myId);
      } catch {
        // Best-effort: re-asserted on the next identity change.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [engine, myId]);

  return null;
}

/**
 * Mounts {@link ProfileEntityBootstrap}. The identity-change ensure effect
 * reacts to sign-in / sign-out via {@link useMyId}.
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
