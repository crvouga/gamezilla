import { useMyId } from '@libs/auth/client/use-current-user';
import { useConfigService } from '@libs/auth/client/config-service-context';
import { useWriteContext } from '@libs/auth/client/use-write-context';
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
  const writeContext = useWriteContext();
  const config = useConfigService();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (myId.length === 0) return;
        // Seed local row immediately. Do not block on waitForFirstSync — a hung
        // connect() left us with empty usernames forever. Online ensure is the
        // uniqueness authority; apply only when card.userId matches myId.
        await ensureProfile(engine.db, writeContext, myId);
        if (cancelled) return;
        const card = await ensureProfileOnline({ config, fetchFn: fetch });
        if (cancelled) return;
        // Token/myId can skew mid-switch — never write another account's card.
        if (card.userId !== myId) {
          return;
        }
        if (card.username.length > 0) {
          await applyEnsuredUsername(engine.db, writeContext, {
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
  }, [config, engine, myId, writeContext]);

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
