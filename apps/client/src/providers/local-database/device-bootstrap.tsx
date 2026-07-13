import { ensureDeviceEntity } from '@libs/auth/client/ensure-device-entity';
import { useDeviceId } from '@libs/auth/client/use-device-id';
import { useWriteContext } from '@libs/auth/client/use-write-context';
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
  const writeContext = useWriteContext();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await ensureDeviceEntity(db, writeContext, deviceId);
        if (cancelled) return;
      } catch {
        // Best-effort: the next refresh from the server will re-assert.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, deviceId, writeContext]);

  return <>{children}</>;
}
