import type { ReactNode } from 'react';

import type { ComponentDataSet } from '../../component-id';
import type { MutationButtonLabels } from '../button/use-mutation-button';
import type { IconComponent } from '../icons';
import type { ScreenTitleScrollProps } from '../screen-title/use-screen-title-scroll';

export type ScreenBaseBreadcrumb = {
  name: ReactNode;
  /** Omit on the final "current" crumb; required on ancestors. */
  onPress?: () => void;
};

export type ScreenBaseActionType =
  | 'submit'
  | 'destructive'
  | 'secondary'
  | 'default';

export type ScreenBaseAction = {
  type: ScreenBaseActionType;
  label: ReactNode;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconComponent;
  endsGroup?: boolean;
  trailing?: ReactNode;
  overflow?: 'auto' | 'always' | 'never';
};

export type BodyContentProps = {
  /**
   * Non-scroll bodies get `flex: 1` + `minHeight: 0` so nested
   * {@link ScreenBodyScrollView} can shrink and scroll. Empty when `scroll`.
   */
  sx: { flex?: 1; minHeight?: 0 };
  /**
   * Present when {@link ScreenBaseProps.largeTitle} is enabled. Attach to a
   * nested scroller (`ScreenBodyScrollView` / `ScrollView`) so the TopBar
   * title reveals after scroll. Whole-body `scroll` wires this internally.
   */
  titleScroll?: ScreenTitleScrollProps;
};

export type ScreenBasePrimaryAction = {
  labels: MutationButtonLabels;
  operation: () => Promise<void>;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
  successHoldMs?: number;
  icon?: IconComponent;
};

export type ScreenBaseProps = {
  /** Stable screen identifier for DOM `data-screen` (E2E / dev tooling). */
  screenId: string;
  /**
   * Navigation trail for the header: the last item supplies the centered
   * title; earlier items with `onPress` drive the back button. Not rendered
   * as a visible breadcrumb row.
   */
  breadcrumbs: ScreenBaseBreadcrumb[];
  actions?: ScreenBaseAction[];
  content: (p: BodyContentProps) => ReactNode;
  /**
   * When true, the body scrolls as a whole with padding inside the scroller
   * (scrollbar flush with the screen edge). When false (default), the body
   * is a padded flex column — nested lists must use
   * {@link ScreenBodyScrollView} / {@link ScreenBodyFlatList} to keep
   * scrollbars flush.
   */
  scroll?: boolean;
  /**
   * When `scroll` is true, attaches themed pull-to-refresh on the body
   * scroller. Omit `refreshing` to manage spinner state for the duration of
   * the async action.
   */
  onRefresh?: (() => void | Promise<void>) | undefined;
  /** Controlled refreshing flag for whole-body `scroll` pull-to-refresh. */
  refreshing?: boolean | undefined;
  /**
   * Large body title that syncs into the TopBar after scroll. Last breadcrumb
   * `name` is the shared title; TopBar title stays hidden until scroll past
   * the reveal offset. With `scroll`, the large title is injected automatically;
   * with nested scrollers, render {@link ScreenLargeTitle} and attach
   * `titleScroll` from the content render prop.
   */
  largeTitle?: boolean;
  keyboardAvoiding?: boolean;
  /**
   * Optional content rendered in the leading (left) slot of the top bar,
   * before any auto-rendered back button. Top-level screens use this for
   * the app logo; nested screens leave it empty and let the back button
   * occupy the slot.
   */
  leading?: ReactNode;
  /**
   * Optional actions area (typically a {@link FormActionsFooter}). Pinned
   * to the bottom of the screen above the safe-area inset so it stays
   * visible while scrolling.
   */
  footer?: ReactNode;
  /**
   * Primary screen action rendered as a floating action button.
   */
  primaryAction?: ScreenBasePrimaryAction;
  /** Extra bottom inset for the primary-action FAB above the tab bar. */
  primaryActionBottomInset?: number;
  /** Always-visible account avatar menu rendered after header actions. */
  accountMenu?: ReactNode;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export type ScreenBaseHeaderProps = {
  breadcrumbs: ScreenBaseBreadcrumb[];
  /** When omitted, empty. */
  actions?: ScreenBaseAction[] | undefined;
  /** See {@link ScreenBaseProps.leading}. */
  leading?: ReactNode | undefined;
  /** Always-visible account menu rendered after header actions. */
  accountMenu?: ReactNode | undefined;
  /**
   * When true, TopBar title is shown only after the body large title scrolls
   * past the reveal threshold (via {@link ScreenTitleProvider}).
   */
  largeTitle?: boolean | undefined;
};
