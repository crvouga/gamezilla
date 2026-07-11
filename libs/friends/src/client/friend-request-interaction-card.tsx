import { InteractionCardDefault } from '@pkgs/inbox/client';
import type { Interaction } from '@pkgs/inbox/client';
import type { InteractionCardActions } from '@pkgs/inbox/client';
import { useRouter } from 'expo-router';
import { useCallback, type ReactNode } from 'react';

type FriendRequestInteractionCardProps = {
  readonly interaction: Interaction;
  readonly actions: InteractionCardActions;
};

export function FriendRequestInteractionCard({
  interaction,
  actions,
}: FriendRequestInteractionCardProps): ReactNode {
  const router = useRouter();
  const onOpen = useCallback(() => {
    void actions.markRead(interaction.id);
    if (interaction.deepLink === undefined) return;
    router.push({
      pathname: interaction.deepLink.path as never,
      params: interaction.deepLink.params as never,
    });
  }, [actions, interaction.deepLink, interaction.id, router]);

  return (
    <InteractionCardDefault
      interaction={interaction}
      actions={actions}
      onOpen={onOpen}
    />
  );
}
