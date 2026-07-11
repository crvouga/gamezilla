import { useLingui } from '@lingui/react/macro';
import { useMemo } from 'react';

import type { FriendshipStatus } from '../shared/friends-types';

export function useFriendUserOverflowMenu(
  status: FriendshipStatus,
  onRemove: () => void,
  onBlock: () => void
) {
  const { t } = useLingui();

  return useMemo(() => {
    if (status !== 'friends') return [];
    return [
      {
        id: 'remove',
        label: t`Remove friend`,
        onPress: onRemove,
      },
      {
        id: 'block',
        label: t`Block`,
        onPress: onBlock,
        endsGroup: true as const,
      },
    ];
  }, [onBlock, onRemove, status, t]);
}
