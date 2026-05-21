import { ensureDeviceEntity } from '@libs/auth/client/ensure-device-entity';
import { useDeviceId } from '@libs/auth/client/use-device-id';
import { usePatchDb } from '@pkgs/patch-db/react';
import { useEffect, type ReactNode } from 'react';

/**
 * Idempotently writes / refreshes the local `device/<deviceId>` entity. The
 * server-side `POST /auth/refresh` re-asserts the row authoritatively after
 * sign-in, so this is just a best-effort cold-start ping for the offline
 * "what device am I?" UX.
 */
export function DeviceEntityBootstrapProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const db = usePatchDb();
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
