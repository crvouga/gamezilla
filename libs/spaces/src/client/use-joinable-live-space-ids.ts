import {
  useMyAccountId,
  useMyDeviceId,
} from '@libs/auth/client/use-current-user';
import { useWatchQuery } from '@pkgs/sync-engine/client/sync-engine-context';
import { useMemo } from 'react';

import { sharedLiveSpaceIdsSql } from './my-live-space-seat-sql';

type SpaceIdRow = { readonly id: string };

/** Live spaces the viewer can join: host / active seat / allowlist. */
export function useJoinableLiveSpaceIds(): {
  readonly spaceIds: readonly string[];
  readonly isLoading: boolean;
} {
  const deviceId = useMyDeviceId();
  const accountId = useMyAccountId();
  const hasAccount = accountId !== null && accountId.length > 0;
  const memberId = hasAccount && accountId !== null ? accountId : deviceId;
  const query = useMemo(
    () =>
      sharedLiveSpaceIdsSql({
        memberId,
        includeHostAccountId: hasAccount,
      }),
    [memberId, hasAccount]
  );
  const { rows, isLoading } = useWatchQuery<SpaceIdRow>(query);
  return { spaceIds: rows.map((r) => r.id), isLoading };
}
