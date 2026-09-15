import { useLingui } from '@lingui/solid/macro';
import type { Accessor } from 'solid-js';
import { createMemo } from 'solid-js';

import type { FriendshipStatus } from '../../shared/friendship/friends-types';

export function useFriendUserOverflowMenu(
  status: Accessor<FriendshipStatus>,
  onRemove: () => void,
  onBlock: () => void
) {
  const { t } = useLingui();

  return createMemo(() => {
    if (status() !== 'friends') return [];
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
  });
}
