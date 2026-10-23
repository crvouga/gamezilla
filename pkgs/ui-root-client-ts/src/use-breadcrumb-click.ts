/**
 * Resolve a breadcrumb's click handler: explicit `onClick` wins; otherwise
 * `href` routes through `useBreadcrumbNav` (pop when possible, else replace).
 *
 * The router hook is only touched when some crumb actually declares `href`,
 * so screens driven purely by `onClick` never need an `AppRouterProvider`.
 */

import type { Href } from '@pkgs/ui-root-shared-ts/href';
import { type Accessor, untrack } from 'solid-js';
import type { ScreenBaseBreadcrumb } from './screen-base-types';
import { useBreadcrumbNav } from './use-breadcrumb-nav';

export type BreadcrumbClickResolver = (
  crumb: ScreenBaseBreadcrumb
) => (() => void) | undefined;

export function useBreadcrumbClick(
  breadcrumbs: Accessor<readonly ScreenBaseBreadcrumb[]>
): BreadcrumbClickResolver {
  // Whether the trail uses router fallbacks is static per screen mount.
  const usesHref = untrack(() =>
    breadcrumbs().some((crumb) => crumb.href !== undefined)
  );
  const nav: ((href: Href) => () => void) | undefined = usesHref
    ? useBreadcrumbNav()
    : undefined;
  return (crumb) => {
    if (crumb.onClick !== undefined) return crumb.onClick;
    if (crumb.href !== undefined && nav !== undefined) return nav(crumb.href);
    return undefined;
  };
}
