import { router, type Href } from 'expo-router';

export type InboxRouteFilter = 'all' | 'action_required' | 'archived';

export function inboxPath(filter?: InboxRouteFilter): Href {
  if (filter === 'action_required') return '/inbox?filter=action_required' as Href;
  return '/inbox' as Href;
}

export function openInbox(options?: {
  readonly filter?: InboxRouteFilter;
  readonly highlightId?: string;
}): void {
  const path = inboxPath(options?.filter);
  if (options?.highlightId !== undefined) {
    router.push({
      pathname: '/inbox',
      params: { highlightId: options.highlightId },
    });
    return;
  }
  router.push(path);
}
