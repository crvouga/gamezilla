import { EnsureDeviceEntity } from '@libs/auth/client/ensure-device-entity';
import { useMutationClient } from '@libs/auth/client/mutation-client-provider';
import { type ReactNode, useEffect } from 'react';

/**
 * Idempotently writes / refreshes the local `devices` row for this install.
 */
export function DeviceEntityBootstrap({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const mutationClient = useMutationClient();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await new EnsureDeviceEntity(mutationClient).run();
        if (cancelled) return;
      } catch {
        // Best-effort: the next refresh from the server will re-assert.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mutationClient]);

  return <>{children}</>;
}
