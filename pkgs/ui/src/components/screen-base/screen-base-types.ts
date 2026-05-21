import type { ReactNode } from 'react';

import type { IconSymbolName } from '../symbol-icon';

export type ScreenBaseBreadcrumb = {
  name: ReactNode;
  /** On the last (current) crumb this becomes the page subtitle. */
  subtitle?: ReactNode;
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
  breadcrumbs: ScreenBaseBreadcrumb[];
  actions?: ScreenBaseAction[];
  content: (p: BodyContentProps) => ReactNode;
  scroll?: boolean;
  keyboardAvoiding?: boolean;
  /**
   * Desktop-only: rendered in the center of the header in place of the
   * breadcrumb title (e.g. a tab strip for top-level screens). On mobile
   * the breadcrumb title is used as usual.
   */
  centerTabs?: ReactNode;
  /**
   * Desktop-only: rendered on the right side of the header alongside
   * actions (e.g. an account avatar trigger). Ignored on mobile.
   */
  headerEnd?: ReactNode;
};

export type ScreenBaseHeaderProps = {
  breadcrumbs: ScreenBaseBreadcrumb[];
  /** When omitted, empty. */
  actions?: ScreenBaseAction[] | undefined;
  /** See {@link ScreenBaseProps.centerTabs}. */
  centerTabs?: ReactNode;
  /** See {@link ScreenBaseProps.headerEnd}. */
  headerEnd?: ReactNode;
};
