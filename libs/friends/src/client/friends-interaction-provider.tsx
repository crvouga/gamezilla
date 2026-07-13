import type {
  Interaction,
  InteractionCardActions,
  InteractionProvider,
} from '@pkgs/inbox/client';

import { FriendRequestInteractionCard } from './friend-request-interaction-card';
import type { FriendsClientDeps } from './search-users/search-users';

export function createFriendsInteractionProvider(
  _deps: FriendsClientDeps
): InteractionProvider {
  return {
    id: 'friends',
    renderCard: (interaction: Interaction, actions: InteractionCardActions) => {
      if (interaction.sourceType === 'friend-request') {
        return (
          <FriendRequestInteractionCard
            interaction={interaction}
            actions={actions}
          />
        );
      }
      return null;
    },
  };
}
