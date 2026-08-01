import { ensureDeviceEntity } from '@libs/auth/client/ensure-device-entity';
import { useDeviceId } from '@libs/auth/client/use-device-id';
import { useRulesAuth } from '@libs/auth/client/use-rules-auth';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { useEffect, type ReactNode } from 'react';

/**
 * Idempotently writes / refreshes the local `devices` row for this install.
 */
export function DeviceEntityBootstrap({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const { db } = useSyncEngine();
  const deviceId = useDeviceId();
  const auth = useRulesAuth();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await ensureDeviceEntity(db, auth, deviceId);
        if (cancelled) return;
      } catch {
        // Best-effort: the next refresh from the server will re-assert.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth, db, deviceId]);

  return <>{children}</>;
}
