import { useCallback } from 'react';

import {
  archiveInteractionRemote,
  dismissInteractionRemote,
  markAllInteractionsReadRemote,
  markInteractionReadRemote,
  performInteractionActionRemote,
} from './inbox-actions';
import { useInboxShell } from './inbox-provider-registry';

export function useInboxActions(): {
  readonly markRead: (interactionId: string) => Promise<void>;
  readonly markAllRead: () => Promise<void>;
  readonly archive: (interactionId: string) => Promise<void>;
  readonly dismiss: (interactionId: string) => Promise<void>;
  readonly performAction: (
    interactionId: string,
    actionId: string
  ) => Promise<void>;
} {
  const { deps } = useInboxShell();

  const markRead = useCallback(
    (interactionId: string) => markInteractionReadRemote(deps, interactionId),
    [deps]
  );
  const markAllRead = useCallback(
    () => markAllInteractionsReadRemote(deps),
    [deps]
  );
  const archive = useCallback(
    (interactionId: string) => archiveInteractionRemote(deps, interactionId),
    [deps]
  );
  const dismiss = useCallback(
    (interactionId: string) => dismissInteractionRemote(deps, interactionId),
    [deps]
  );
  const performAction = useCallback(
    (interactionId: string, actionId: string) =>
      performInteractionActionRemote(deps, interactionId, actionId),
    [deps]
  );

  return { markRead, markAllRead, archive, dismiss, performAction };
}
