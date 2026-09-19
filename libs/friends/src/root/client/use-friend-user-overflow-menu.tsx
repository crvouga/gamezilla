import { Handles } from '@libs/test-ids';
import { useLingui } from '@lingui/solid/macro';
import type { Accessor } from 'solid-js';
import { createMemo } from 'solid-js';

import type { FriendshipStatus } from '../../shared/friendship/friends-types';

export function useFriendUserOverflowMenu(
  status: Accessor<FriendshipStatus>,
  onRemove: () => void,
  onBlock: () => void,
  username: Accessor<string>
) {
  const { t } = useLingui();

  return createMemo(() => {
    if (status() !== 'friends') return [];
    const user = username();
    return [
      {
        id: 'remove',
        label: t`Remove friend`,
        onPress: onRemove,
        dataSet: { testid: Handles.friendRemove(user) },
      },
      {
        id: 'block',
        label: t`Block`,
        onPress: onBlock,
        endsGroup: true as const,
        dataSet: { testid: Handles.friendBlock(user) },
      },
    ];
  });
}
