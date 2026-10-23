import {
  archiveInteractionRemote,
  dismissInteractionRemote,
  markAllInteractionsReadRemote,
  markInteractionReadRemote,
  performNotificationActionRemote,
} from '@libs/notifications-shared-ts/notifications-actions';
import { useNotificationsShell } from './notifications-provider-registry';

export function useNotificationsActions(): {
  readonly markRead: (interactionId: string) => Promise<void>;
  readonly markAllRead: () => Promise<void>;
  readonly archive: (interactionId: string) => Promise<void>;
  readonly dismiss: (interactionId: string) => Promise<void>;
  readonly performAction: (
    interactionId: string,
    actionId: string
  ) => Promise<void>;
} {
  const shell = useNotificationsShell();

  const markRead = (interactionId: string): Promise<void> =>
    markInteractionReadRemote(shell.deps, interactionId);
  const markAllRead = (): Promise<void> =>
    markAllInteractionsReadRemote(shell.deps);
  const archive = (interactionId: string): Promise<void> =>
    archiveInteractionRemote(shell.deps, interactionId);
  const dismiss = (interactionId: string): Promise<void> =>
    dismissInteractionRemote(shell.deps, interactionId);
  const performAction = (
    interactionId: string,
    actionId: string
  ): Promise<void> =>
    performNotificationActionRemote(shell.deps, interactionId, actionId);

  return { markRead, markAllRead, archive, dismiss, performAction };
}
