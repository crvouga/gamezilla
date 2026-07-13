import { useMyId } from '@libs/auth/client/use-current-user';
import { useConfigService } from '@libs/auth/client/config-service-context';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { useEffect, type ReactNode } from 'react';

import { ensureProfile } from './ensure-profile-entity';
import { ensureProfileOnline } from './profile-online-actions';

/**
 * Profile bootstrap: ensures a local profile row exists, then asks the API to
 * assign a globally unique username if needed. Waits for the first sync
 * download so a new web tab does not mint a fresh profile before the server
 * row arrives.
 */
function ProfileEntityBootstrap(): null {
  const engine = useSyncEngine();
  const myId = useMyId();
  const config = useConfigService();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (myId.length === 0) return;
        await engine.waitForFirstSync();
        if (cancelled) return;
        await ensureProfile(engine.db, myId);
        if (cancelled) return;
        await ensureProfileOnline({ config, fetchFn: fetch });
      } catch {
        // Best-effort: re-asserted on the next identity change.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [config, engine, myId]);

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
