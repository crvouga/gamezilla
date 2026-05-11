import { useAccountIdModel } from '@gamezilla/auth/client/account-id-context';
import { AuthProvider } from '@gamezilla/auth/client/auth-context';
import { useDeviceService } from '@gamezilla/auth/client/device-service-context';
import { usePatchDb } from '@gamezilla/patch-db/react';
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';

import { ensureProfile } from './ensure-profile-entity';

/**
 * Profile bootstrap: ensures a profile row exists for the current replication
 * identity (install id when anonymous, account id when signed in). Re-runs
 * whenever the in-memory account id changes (sign in / out).
 */
function ProfileEntityBootstrap(): null {
  const db = usePatchDb();
  const device = useDeviceService();
  const accountModel = useAccountIdModel();
  const accountIdStr = useSyncExternalStore(
    accountModel.subscribe,
    () => accountModel.getAccountId(),
    () => accountModel.getAccountId()
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const installId = device.getDeviceId();
        const myId =
          accountIdStr !== null && accountIdStr.length > 0
            ? accountIdStr
            : installId;
        await ensureProfile(db, myId);
        if (cancelled) return;
      } catch {
        // Best-effort: re-asserted on the next identity change.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, device, accountIdStr]);

  return null;
}

/**
 * Wraps {@link AuthProvider} with the `ensureProfile` callback the auth
 * sign-in finalizer needs, plus the post-identity-change ensure effect. Keeps
 * `app-providers.tsx` ignorant of profile internals.
 */
export function ProfileProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <AuthProvider ensureProfile={ensureProfile}>
      <ProfileEntityBootstrap />
      {children}
    </AuthProvider>
  );
}
