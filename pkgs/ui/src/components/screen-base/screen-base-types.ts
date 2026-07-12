import type { ReactNode } from 'react';

import type { MutationButtonLabels } from '../button/use-mutation-button';
import type { IconComponent } from '../icons';

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
  sx: { flex: 1 };
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
  /**
   * Navigation trail for the header: the last item supplies the centered
   * title; earlier items with `onPress` drive the back button. Not rendered
   * as a visible breadcrumb row.
   */
  breadcrumbs: ScreenBaseBreadcrumb[];
  actions?: ScreenBaseAction[];
  content: (p: BodyContentProps) => ReactNode;
  scroll?: boolean;
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
};

export type ScreenBaseHeaderProps = {
  breadcrumbs: ScreenBaseBreadcrumb[];
  /** When omitted, empty. */
  actions?: ScreenBaseAction[] | undefined;
  /** See {@link ScreenBaseProps.leading}. */
  leading?: ReactNode | undefined;
  /** Always-visible account menu rendered after header actions. */
  accountMenu?: ReactNode | undefined;
};
