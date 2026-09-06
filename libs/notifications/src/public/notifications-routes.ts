import { type Href, router } from '@pkgs/ui-rn';

export type InboxRouteFilter = 'all' | 'action_required' | 'archived';

export function notificationsPath(filter?: InboxRouteFilter): Href {
  if (filter === 'action_required')
    return '/notifications?filter=action_required' as Href;
  return '/notifications' as Href;
}

export function openNotifications(options?: {
  readonly filter?: InboxRouteFilter;
  readonly highlightId?: string;
}): void {
  const path = notificationsPath(options?.filter);
  if (options?.highlightId !== undefined) {
    router.push({
      pathname: '/notifications',
      params: { highlightId: options.highlightId },
    });
    return;
  }
  router.push(path);
}
