import { useLingui } from '@lingui/react/macro';
import { Box } from '@pkgs/ui';
import { type ReactNode, useCallback } from 'react';

import type { FriendshipStatus } from '../../shared/friends-types';
import { renderFriendActionPillsForStatus } from './friend-action-status-renderers';
import type { FriendActionMutations } from './friend-action-types';

export function FriendActionPillsForStatus({
  status,
  mutations,
  onChanged,
}: {
  status: FriendshipStatus;
  mutations: FriendActionMutations;
  onChanged?: (() => void) | undefined;
}): ReactNode {
  const { t } = useLingui();
  const wrap = useCallback(
    (fn: () => Promise<void>) => async () => {
      await fn();
      onChanged?.();
    },
    [onChanged]
  );
  const pills = renderFriendActionPillsForStatus(status, mutations, wrap, t);

  if (status === 'blocked_by_them') {
    return <Box sx={{ alignSelf: 'stretch' }}>{pills}</Box>;
  }

  return pills;
}
