import { useMyId } from '@libs/auth/client/use-current-user';
import { useConfigService } from '@libs/auth/client/config-service-context';
import { useCurrentAccountId } from '@libs/auth/client/use-current-account-id';
import { useFreshAuthToken } from '@libs/auth/client/use-fresh-auth-token';
import { useRulesAuth } from '@libs/auth/client/use-rules-auth';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { useEffect, type ReactNode } from 'react';

import {
  applyEnsuredUsername,
  ensureProfile,
} from './ensure-profile-local/ensure-profile';
import { ensureProfileOnline } from './ensure-profile-online/ensure-profile-online';

/**
 * Profile bootstrap: ensures a local profile row exists, then asks the API to
 * assign a globally unique username if needed. Applies the ensure response
 * username locally when the card matches the active account.
 */
function ProfileEntityBootstrap(): null {
  const engine = useSyncEngine();
  const myId = useMyId();
  const accountId = useCurrentAccountId();
  const sessionToken = useFreshAuthToken();
  const auth = useRulesAuth();
  const config = useConfigService();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (myId.length === 0) return;
        // Session present but /auth/refresh has not written lastLocalAccountId
        // yet — useMyId would fall back to deviceId and seed a throwaway
        // device profile. Wait for a stable account id.
        if (sessionToken !== null && accountId === null) return;
        // Seed local row immediately. Do not block on waitForFirstSync — a hung
        // connect() left us with empty usernames forever. Online ensure is the
        // uniqueness authority; apply only when card.userId matches myId.
        await ensureProfile(engine.db, auth, myId);
        if (cancelled) return;
        const card = await ensureProfileOnline({
          config,
          fetchFn: globalThis.fetch.bind(globalThis),
        });
        if (cancelled) return;
        // Token/myId can skew mid-switch — never write another account's card.
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
  }, [accountId, auth, config, engine, myId, sessionToken]);

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
