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
  // #region agent log
  fetch('http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': 'b580fa',
    },
    body: JSON.stringify({
      sessionId: 'b580fa',
      location: 'auth-patch-db-bridge.tsx:render',
      message: 'AuthPatchDbBridge render',
      hypothesisId: 'H9',
      data: { accountId: null },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
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
      // #region agent log
      fetch(
        'http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Debug-Session-Id': 'b580fa',
          },
          body: JSON.stringify({
            sessionId: 'b580fa',
            location: 'auth-patch-db-bridge.tsx:flush:done',
            message: 'identity flush done',
            hypothesisId: 'H1',
            data: { installDeviceId },
            timestamp: Date.now(),
          }),
        }
      ).catch(() => {});
      // #endregion
    });
    if (accountId !== null) {
      void flushPatchDbIdentityOnSignIn(deviceId).catch(() => undefined);
    }
    return unregister;
  }, [sync, deviceId, accountId]);

  return children;
}
