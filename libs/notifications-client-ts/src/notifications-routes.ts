import type { AppRouter } from '@pkgs/ui-root-client-ts/app-router';
import type { Href } from '@pkgs/ui-root-shared-ts/href';

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
