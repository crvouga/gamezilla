import type { ReactNode } from 'react';
import type { Interaction } from './interaction';
import type { InteractionCardActions } from './interaction-action';

export interface InteractionProvider {
  readonly id: string;
  renderCard?(
    interaction: Interaction,
    actions: InteractionCardActions
  ): ReactNode | null;
}
