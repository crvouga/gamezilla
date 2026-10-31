/**
 * Resolve a breadcrumb's click handler: explicit `onClick` wins; otherwise
 * compact back controls pop app history when possible, else replace to `href`.
 *
 * Router context is optional until a routed crumb is activated. Persistent
 * header islands can change from callback-only to href trails without stale
 * routing contexts. Pill ancestors navigate to their named route.
 */

import { releaseWebFocus } from '@pkgs/ui-root-shared-ts/release-web-focus';
import { useOptionalRouter } from './app-router/index';
import type { ScreenBaseBreadcrumb } from './screen-base-types';

export type BreadcrumbClickResolver = (
  crumb: ScreenBaseBreadcrumb
) => (() => void) | undefined;

export function useBreadcrumbClick(
  navigation: 'back' | 'ancestor' = 'back'
): BreadcrumbClickResolver {
  const router = useOptionalRouter();
  return (crumb) => {
    if (crumb.onClick !== undefined) return crumb.onClick;
    const href = crumb.href;
    if (href === undefined) return undefined;
    return () => {
      if (router === undefined)
        throw new Error('Breadcrumb href requires AppRouterProvider');
      releaseWebFocus();
      if (navigation === 'ancestor') router.push(href);
      else if (router.canGoBack()) router.back();
      else router.replace(href);
    };
  };
}
