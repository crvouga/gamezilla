/**
 * Framework-free helpers for `ScreenBase`: header action partitioning,
 * breadcrumb derivation, and body content props. No Solid imports at runtime
 * (types only) so it unit-tests bare.
 */

import type { JSX } from 'solid-js';
import type {
  ActionBarItem,
  ActionBarTextAction,
  ScreenBaseActionLike,
} from '../action-bar/action-bar-logic';
import { screenBaseActionToActionBarItem } from '../action-bar/action-bar-logic';
import type { ScreenTitleScrollProps } from '../screen-title';
import type {
  BodyContentProps,
  ScreenBaseAction,
  ScreenBaseActionType,
  ScreenBaseBreadcrumb,
} from './screen-base-types';

/** Scroll inset below body content (px). */
export const SCREEN_SCROLL_BOTTOM_PADDING = 24;

export type ScreenBaseActionIntent = 'primary' | 'danger' | 'neutral';

export function screenBaseActionIntent(
  type: ScreenBaseActionType
): ScreenBaseActionIntent {
  switch (type) {
    case 'submit':
      return 'primary';
    case 'destructive':
      return 'danger';
    default:
      return 'neutral';
  }
}

export type ScreenBaseActionPartition = {
  iconItems: ActionBarItem[];
  textActions: ActionBarTextAction[];
};

/** Icon actions become `ActionBar` items; icon-less ones become text buttons. */
export function partitionScreenBaseActions(
  actions: readonly ScreenBaseAction[]
): ScreenBaseActionPartition {
  const iconItems: ActionBarItem[] = [];
  const textActions: ActionBarTextAction[] = [];
  actions.forEach((action, index) => {
    const like: ScreenBaseActionLike = action;
    const iconItem = screenBaseActionToActionBarItem(like, `action-${index}`);
    if (iconItem !== null) {
      iconItems.push({ ...iconItem, trailing: action.trailing });
      return;
    }
    textActions.push({
      id: `text-action-${index}`,
      label: action.label,
      onClick: action.onClick,
      intent: screenBaseActionIntent(action.type),
      loading: action.loading ?? false,
      disabled: action.disabled ?? false,
      overflow: action.overflow,
    });
  });
  return { iconItems, textActions };
}

export function hasScreenBaseActions(
  partition: ScreenBaseActionPartition
): boolean {
  return partition.iconItems.length > 0 || partition.textActions.length > 0;
}

/** Title shared by the TopBar / large title: the last crumb's `name`. */
export function lastBreadcrumbTitle(
  breadcrumbs: readonly ScreenBaseBreadcrumb[]
): JSX.Element | undefined {
  return breadcrumbs[breadcrumbs.length - 1]?.name;
}

/** A crumb navigates when it has an explicit handler or a fallback route. */
export function isNavigableBreadcrumb(crumb: ScreenBaseBreadcrumb): boolean {
  return crumb.onClick !== undefined || crumb.href !== undefined;
}

export type ScreenBaseHeaderLayout = {
  title: JSX.Element | undefined;
  backCrumb: ScreenBaseBreadcrumb | undefined;
  showBack: boolean;
};

/** Compact header: title from the last crumb, back from the one before it. */
export function deriveHeaderLayout(
  breadcrumbs: readonly ScreenBaseBreadcrumb[]
): ScreenBaseHeaderLayout {
  const backCrumb =
    breadcrumbs.length >= 2 ? breadcrumbs[breadcrumbs.length - 2] : undefined;
  return {
    title: lastBreadcrumbTitle(breadcrumbs),
    backCrumb,
    showBack: backCrumb !== undefined && isNavigableBreadcrumb(backCrumb),
  };
}

export type BreadcrumbTrail = {
  ancestors: ScreenBaseBreadcrumb[];
  current: ScreenBaseBreadcrumb | undefined;
};

/** Wide header: visible ancestors row + the current crumb as page title. */
export function splitBreadcrumbTrail(
  breadcrumbs: readonly ScreenBaseBreadcrumb[]
): BreadcrumbTrail {
  return {
    ancestors: breadcrumbs.slice(0, -1),
    current: breadcrumbs[breadcrumbs.length - 1],
  };
}

export function buildBodyContentProps(
  scroll: boolean,
  titleScroll: ScreenTitleScrollProps | undefined
): BodyContentProps {
  const bodyClass = scroll ? '' : 'flex-1 min-h-0';
  if (titleScroll === undefined) return { bodyClass };
  return { bodyClass, titleScroll };
}

/**
 * Whether the body must absorb the bottom safe-area inset itself. Pinned
 * chrome (footer / bottom bar) absorbs it instead when present.
 */
export function bodyNeedsSafeBottom(p: {
  hasFooter: boolean;
  hasBottomBar: boolean;
}): boolean {
  return !(p.hasFooter || p.hasBottomBar);
}
