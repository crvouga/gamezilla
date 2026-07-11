import { Box } from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import { useCallback, type ReactNode } from 'react';

import type { FriendMutations } from './friend-action-context';
import { renderFriendActionPillsForStatus } from './friend-action-status-renderers';
import type { FriendshipStatus } from '../shared/friends-types';

export function FriendActionPillsForStatus({
  status,
  mutations,
  onChanged,
}: {
  status: FriendshipStatus;
  mutations: FriendMutations;
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
