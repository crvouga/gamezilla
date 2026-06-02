import type { ReactNode } from 'react';

import type { IconSymbolName } from '../symbol-icon';

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
  icon?: IconSymbolName;
  endsGroup?: boolean;
  trailing?: ReactNode;
  overflow?: 'auto' | 'always' | 'never';
};

export type BodyContentProps = {
  sx: { flex: 1 };
};

export type ScreenBaseProps = {
  /**
   * Navigation trail for the header: the last item supplies the centered
   * title; earlier items with `onPress` drive the mobile back button. Not
   * rendered as a visible breadcrumb row.
   */
  breadcrumbs: ScreenBaseBreadcrumb[];
  actions?: ScreenBaseAction[];
  content: (p: BodyContentProps) => ReactNode;
  scroll?: boolean;
  keyboardAvoiding?: boolean;
  /**
   * Desktop-only: rendered in the center of the header in place of the page
   * title (e.g. a tab strip for top-level screens). On mobile the title from
   * `breadcrumbs` is used as usual.
   */
  centerTabs?: ReactNode;
  /**
   * Desktop-only: rendered on the right side of the header alongside
   * actions (e.g. an account avatar trigger). Ignored on mobile.
   */
  headerEnd?: ReactNode;
  /**
   * Optional content rendered in the leading (left) slot of the top bar,
   * before any auto-rendered back button. Top-level screens use this for
   * the app logo; nested screens leave it empty and let the back button
   * occupy the slot.
   */
  leading?: ReactNode;
  /**
   * Optional actions area (typically a {@link FormActionsFooter}). On mobile
   * it is pinned to the bottom of the screen above the safe-area inset so it
   * stays visible while scrolling; on wider screens it renders inline at the
   * end of the form body.
   */
  footer?: ReactNode;
};

export type ScreenBaseHeaderProps = {
  breadcrumbs: ScreenBaseBreadcrumb[];
  /** When omitted, empty. */
  actions?: ScreenBaseAction[] | undefined;
  /** See {@link ScreenBaseProps.centerTabs}. */
  centerTabs?: ReactNode | undefined;
  /** See {@link ScreenBaseProps.headerEnd}. */
  headerEnd?: ReactNode | undefined;
  /** See {@link ScreenBaseProps.leading}. */
  leading?: ReactNode | undefined;
};
