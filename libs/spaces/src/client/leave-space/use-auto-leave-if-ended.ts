import { useLeaveSpace } from './use-leave-space';
import { useMyAccountId } from '@libs/auth/client/use-current-user';
import { useEffect } from 'react';

import { useSpaceColumn, SpaceField } from '../use-space-column';
import { useOpenSpaceIds } from '../open-space/use-open-space-ids';

/** When a locally-open space ends, run leave (host already ended; guest closes). */
export function useAutoLeaveIfEnded(spaceId: string): void {
  const leaveSpace = useLeaveSpace();
  const endedAt = useSpaceColumn(spaceId, SpaceField.endedAt);
  const accountId = useMyAccountId();
  const { isOpen } = useOpenSpaceIds();
  const spaceEnded = endedAt !== null;
  const hasAccount = accountId !== null && accountId.length > 0;

  useEffect(() => {
    if (spaceId.length === 0) return;
    if (!hasAccount) return;
    if (!spaceEnded) return;
    if (!isOpen(spaceId)) return;
    void leaveSpace(spaceId);
  }, [spaceId, hasAccount, spaceEnded, isOpen, leaveSpace]);
}
