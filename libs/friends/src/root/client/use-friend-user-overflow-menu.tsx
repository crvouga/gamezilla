import { Handles } from '@libs/test-ids';
import { useLingui } from '@lingui/solid/macro';
import type { Accessor } from 'solid-js';
import { createMemo } from 'solid-js';

import type { FriendshipStatus } from '../../shared/friendship/friends-types';

type FriendUserMenuAction = {
  readonly id: string;
  readonly label: string;
  readonly onPress: () => void;
  readonly endsGroup?: true;
  readonly dataSet: { readonly testid: string };
};

export function useFriendUserOverflowMenu(
  status: Accessor<FriendshipStatus>,
  onRemove: () => void,
  onBlock: () => void,
  username: Accessor<string>
) {
  const { t } = useLingui();

  return createMemo((): FriendUserMenuAction[] => {
    const user = username();
    const block: FriendUserMenuAction = {
      id: 'block',
      label: t`Block`,
      onPress: onBlock,
      endsGroup: true,
      dataSet: { testid: Handles.friendBlock(user) },
    };
    // Anyone can be blocked — a stranger who keeps asking most of all. Once
    // blocked, the profile's Unblock pill is the only action left.
    if (status() === 'blocked_by_me' || status() === 'blocked_by_them') {
      return [];
    }
    if (status() !== 'friends') return [block];
    return [
      {
        id: 'remove',
        label: t`Remove friend`,
        onPress: onRemove,
        dataSet: { testid: Handles.friendRemove(user) },
      },
      block,
    ];
  });
}
