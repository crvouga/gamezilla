import { useWriteContext } from '@libs/auth/client/use-write-context';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { runClientWrite } from '@pkgs/write/client/run-client-write';
import { useEffect, type ReactNode } from 'react';

import { claimSpaceParticipationsWrite } from '../../shared/claim-space-participations/claim-space-participations-write';

/**
 * After auth identity settles, rebind this device's active space seats so
 * `member_id` matches `accountId ?? deviceId`. Prevents stuck mini-player /
 * failed leave after anon↔signed-in transitions.
 */
export function ClaimSpaceParticipationsBootstrap({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const writeContext = useWriteContext();
  const engine = useSyncEngine();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await runClientWrite(
          claimSpaceParticipationsWrite,
          writeContext,
          {},
          engine.db
        );
        if (cancelled) return;
      } catch {
        // Best-effort; leave-space still self-heals mismatched seats.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [engine, writeContext]);

  return <>{children}</>;
}
