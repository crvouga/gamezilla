import { useDeviceService } from '@gamezilla/auth/client/device-service-context';
import { ensureDeviceEntity } from '@gamezilla/auth/client/ensure-device-entity';
import { usePatchDb } from '@gamezilla/patch-db/react';
import { useEffect, type ReactNode } from 'react';

/**
 * Idempotently writes the device entity into the patch-db on mount. Runs once
 * — there is no longer a stack swap that could re-trigger it.
 */
export function DeviceEntityBootstrapProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const device = useDeviceService();
  const db = usePatchDb();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const installId = device.getDeviceId();
        await ensureDeviceEntity(db, installId);
        if (cancelled) return;
      } catch {
        // Best-effort: device row will be re-asserted on the next mount.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, device]);

  return <>{children}</>;
}
