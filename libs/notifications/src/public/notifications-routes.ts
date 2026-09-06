import type { AppRouter, Href } from '@pkgs/ui';

export type InboxRouteFilter = 'all' | 'action_required' | 'archived';

export function notificationsPath(filter?: InboxRouteFilter): Href {
  if (filter === 'action_required')
    return '/notifications?filter=action_required';
  return '/notifications';
}

export function openNotifications(
  router: AppRouter,
  options?: {
    readonly filter?: InboxRouteFilter;
    readonly highlightId?: string;
  }
): void {
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
