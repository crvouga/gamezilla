import type { ReactNode } from 'react';
import type { Notification } from './notification';
import type { NotificationCardActions } from './notification-action';

export interface NotificationProvider {
  readonly id: string;
  /**
   * Custom card chrome. When provided and non-null, replaces the default card.
   * Prefer this for bespoke layouts (avatar, modal ownership).
   */
  renderCard?(
    interaction: Notification,
    actions: NotificationCardActions
  ): ReactNode | null;
  /**
   * Card-press handler for the default card. When set (and `renderCard` is
   * omitted/null), the default card becomes a summary surface with no inline
   * action buttons; the provider owns follow-up UI (e.g. a decision modal).
   */
  onCardPress?(
    interaction: Notification,
    actions: NotificationCardActions
  ): void;
}
