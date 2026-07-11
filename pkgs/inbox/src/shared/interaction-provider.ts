import type { ReactNode } from 'react';

import type { InteractionCardActions } from './interaction-action';
import type { Interaction } from './interaction';

export interface InteractionProvider {
  readonly id: string;
  renderCard?(
    interaction: Interaction,
    actions: InteractionCardActions
  ): ReactNode | null;
}
