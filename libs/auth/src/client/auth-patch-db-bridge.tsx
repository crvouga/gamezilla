import { useSync } from '@pkgs/patch-db/react';
import { useLayoutEffect, type ReactNode } from 'react';

import { useCurrentAccountId } from './use-current-account-id';
import { useDeviceId } from './use-device-id';
import {
  flushPatchDbIdentityOnSignIn,
  registerPatchDbIdentityFlush,
} from './patch-db-identity-flush';

/**
 * On first sign-in for this session, drop anonymous outbox rows (stamped with
 * the install device id) so the next push is not rejected for
 * `patch/created-by-id must match author`.
 */
export function AuthPatchDbBridge({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const deviceId = useDeviceId();
  const accountId = useCurrentAccountId();
  const sync = useSync();

  useLayoutEffect(() => {
    const unregister = registerPatchDbIdentityFlush(async (installDeviceId) => {
      await sync.clearRejectedPushes();
      await sync.markUnsyncedPatchesWithCreatedByAsAlreadyOnRemote(
        installDeviceId
      );
      await sync.runPushNow();
    });
    if (accountId !== null) {
      void flushPatchDbIdentityOnSignIn(deviceId).catch(() => undefined);
    }
    return unregister;
  }, [sync, deviceId, accountId]);

  return children;
}
