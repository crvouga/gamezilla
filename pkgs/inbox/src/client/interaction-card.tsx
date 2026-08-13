import { useRouter } from '@pkgs/ui';
import { type ReactNode, useCallback } from 'react';

import type { Interaction } from '../shared/interaction';
import type { InteractionCardActions } from '../shared/interaction-action';
import { useInteractionRenderProvider } from './inbox-provider-registry';
import { InteractionCardDefault } from './interaction-card-default';

export type InteractionCardProps = {
  readonly interaction: Interaction;
  readonly actions: InteractionCardActions;
};

export function InteractionCard({
  interaction,
  actions,
}: InteractionCardProps): ReactNode {
  const router = useRouter();
  const provider = useInteractionRenderProvider(interaction.sourceNamespace);

  const onOpen = useCallback(() => {
    void actions.markRead(interaction.id);
    if (interaction.deepLink === undefined) return;
    router.push({
      pathname: interaction.deepLink.path as never,
      params: interaction.deepLink.params as never,
    });
  }, [actions, interaction.deepLink, interaction.id, router]);

  const custom = provider?.renderCard?.(interaction, actions);
  if (custom !== undefined && custom !== null) return custom;

  return (
    <InteractionCardDefault
      interaction={interaction}
      actions={actions}
      onOpen={onOpen}
    />
  );
}
