import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import type { Href } from '@pkgs/ui-root-shared-ts/href';
import type { JSX } from 'solid-js';
import type { ActionBarOverflowPolicy } from './action-bar-logic';
import type { IconComponent } from './create-icon/index';
import type { OverflowMenuRenderProps } from './overflow-menu-button/index';
import type { ScreenMeasure } from './screen-measure';
import type { MutationButtonLabels } from './use-mutation-button/index';
import type { ScreenTitleScrollProps } from './use-screen-title-scroll';

export type ScreenBaseBreadcrumb = {
  name: JSX.Element;
  /** Omit on the final "current" crumb; required (or `href`) on ancestors. */
  onClick?: (() => void) | undefined;
  /**
   * Fallback route for ancestor crumbs. When `onClick` is omitted the crumb
   * navigates through `useBreadcrumbNav` (pop history when possible, else
   * replace to `href`). Requires an `AppRouterProvider`.
   */
  href?: Href | undefined;
};

export type ScreenBaseActionType =
  | 'submit'
  | 'destructive'
  | 'secondary'
  | 'default';

export type ScreenBaseAction = {
  type: ScreenBaseActionType;
  label: JSX.Element;
  onClick: () => void;
  loading?: boolean | undefined;
  disabled?: boolean | undefined;
  icon?: IconComponent | undefined;
  endsGroup?: boolean | undefined;
  trailing?: JSX.Element | undefined;
  overflow?: ActionBarOverflowPolicy | undefined;
  dataSet?: ComponentDataSet | undefined;
};

export type BodyContentProps = {
  /**
   * Non-scroll bodies get `flex-1 min-h-0` so nested
   * {@link ScreenBodyScrollView} can shrink and scroll. Empty when `scroll`.
   */
  bodyClass: string;
  /**
   * Present when {@link ScreenBaseProps.largeTitle} is enabled. Spread onto a
   * nested scroller (`ScreenBodyScrollView` / `ScrollView`) so the TopBar
   * title reveals after scroll. Whole-body `scroll` wires this internally.
   */
  titleScroll?: ScreenTitleScrollProps | undefined;
};

export type ScreenBasePrimaryAction = {
  labels: MutationButtonLabels;
  operation: () => Promise<void>;
  onSuccess?: (() => void) | undefined;
  onError?: ((error: Error) => void) | undefined;
  disabled?: boolean | undefined;
  successHoldMs?: number | undefined;
  icon?: IconComponent | undefined;
  /** DOM `data-*` identifiers for the FAB / primary button. */
  dataSet?: ComponentDataSet | undefined;
};

export type ScreenBaseProps = {
  /** Stable screen identifier for DOM `data-screen` (spec / dev tooling). */
  screenId: string;
  /**
   * Navigation trail for the header: the last item supplies the centered
   * title; earlier items with `onClick` / `href` drive the back button. On
   * compact, not rendered as a visible breadcrumb row. On wide, rendered as
   * a visible trail in the page header.
   */
  breadcrumbs: readonly ScreenBaseBreadcrumb[];
  actions?: readonly ScreenBaseAction[] | undefined;
  content: (p: BodyContentProps) => JSX.Element;
  /**
   * When true, the body scrolls as a whole with padding inside the scroller
   * (scrollbar flush with the screen edge). When false (default), the body
   * is a padded flex column — nested lists must use
   * {@link ScreenBodyScrollView} / {@link ScreenBodyVirtualList} to keep
   * scrollbars flush.
   */
  scroll?: boolean | undefined;
  /**
   * Large body title that syncs into the TopBar after scroll. Last breadcrumb
   * `name` is the shared title; TopBar title stays hidden until scroll past
   * the reveal offset. With `scroll`, the large title is injected
   * automatically; with nested scrollers, render `ScreenLargeTitle` and
   * spread `titleScroll` from the content render prop.
   */
  largeTitle?: boolean | undefined;
  /**
   * Optional content rendered in the leading (left) slot of the top bar,
   * before any auto-rendered back button.
   */
  leading?: JSX.Element | undefined;
  /**
   * Optional actions area (typically a `FormActionsFooter`). Pinned to the
   * bottom of the screen above the safe-area inset so it stays visible while
   * scrolling.
   */
  footer?: JSX.Element | undefined;
  /**
   * Optional full-bleed bottom chrome (typically a `BottomActionBar`). Pinned
   * under the footer; on compact it also absorbs the bottom safe-area inset.
   */
  bottomBar?: JSX.Element | undefined;
  /**
   * The measure of the body's column (`ScreenColumn`). On wide layouts the
   * page header (breadcrumb trail, actions) is held to the same centered
   * column so the title lines up with the content. Omit, or `full`, for a
   * body that spans the frame column (collections, workspaces).
   */
  measure?: ScreenMeasure | undefined;
  /** Primary screen action rendered as a floating action button. */
  primaryAction?: ScreenBasePrimaryAction | undefined;
  /** Extra bottom inset for the primary-action FAB above the tab bar. */
  primaryActionBottomInset?: number | undefined;
  /**
   * Renders the anchored overflow menu for header actions (e.g.
   * `FloatingMenu`). Without it, overflowed actions collapse behind a More
   * trigger that only reports `onOpenMenu`.
   */
  renderActionsMenu?:
    | ((menu: OverflowMenuRenderProps) => JSX.Element)
    | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

export type ScreenBaseHeaderProps = {
  breadcrumbs: readonly ScreenBaseBreadcrumb[];
  /** When omitted, empty. */
  actions?: readonly ScreenBaseAction[] | undefined;
  /** See {@link ScreenBaseProps.leading}. */
  leading?: JSX.Element | undefined;
  /**
   * When true, TopBar title is shown only after the body large title scrolls
   * past the reveal threshold (via `ScreenTitleProvider`).
   */
  largeTitle?: boolean | undefined;
  /** The body has scrolled under the bar: draw its bottom hairline. */
  scrolled?: boolean | undefined;
  /**
   * Compact-only trailing chrome after header actions (e.g. avatar menu).
   * Wide page headers must not duplicate this — the AppFrame island owns it.
   */
  globalTrailing?: JSX.Element | undefined;
  /** See {@link ScreenBaseProps.renderActionsMenu}. */
  renderActionsMenu?:
    | ((menu: OverflowMenuRenderProps) => JSX.Element)
    | undefined;
};
