import { useLingui } from '@lingui/solid';
import type { Accessor } from 'solid-js';
import { createMemo } from 'solid-js';

import type { FriendshipStatus } from '../../shared/friendship/friends-types';

export function useFriendUserOverflowMenu(
  status: Accessor<FriendshipStatus>,
  onRemove: () => void,
  onBlock: () => void
) {
  const { _ } = useLingui();

  return createMemo(() => {
    if (status() !== 'friends') return [];
    return [
      {
        id: 'remove',
        label: _({ id: 'Remove friend', message: 'Remove friend' }),
        onPress: onRemove,
      },
      {
        id: 'block',
        label: _({ id: 'Block', message: 'Block' }),
        onPress: onBlock,
        endsGroup: true as const,
      },
    ];
  });
}
