import { useDeviceId } from '@gamezilla/auth/client/use-device-id';
import { useCurrentAccountId } from '@gamezilla/auth/client/use-current-account-id';
import { usePatchDb } from '@gamezilla/patch-db/react';
import { useEffect, type ReactNode } from 'react';

import { ensureProfile } from './ensure-profile-entity';

/**
 * Profile bootstrap: ensures a profile row exists for the current replication
 * identity (install id when anonymous, account id when signed in). Re-runs
 * whenever the in-memory account id changes (sign in / out).
 */
function ProfileEntityBootstrap(): null {
  const db = usePatchDb();
  const deviceId = useDeviceId();
  const accountId = useCurrentAccountId();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const myId = accountId !== null ? accountId : deviceId;
        await ensureProfile(db, myId);
        if (cancelled) return;
      } catch {
        // Best-effort: re-asserted on the next identity change.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, deviceId, accountId]);

  return null;
}

/**
 * Mounts {@link ProfileEntityBootstrap}. The identity-change ensure effect
 * reacts to sign-in / sign-out via `useCurrentAccountId`.
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
