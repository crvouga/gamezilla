import { ensureDeviceEntity } from '@libs/auth/client/ensure-device-entity';
import { useDeviceId } from '@libs/auth/client/use-device-id';
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await ensureDeviceEntity(db, deviceId);
        if (cancelled) return;
      } catch {
        // Best-effort: the next refresh from the server will re-assert.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, deviceId]);

  return <>{children}</>;
}
