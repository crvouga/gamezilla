/**
 * Item + props types for {@link BottomActionBar}.
 *
 * Two slot kinds share one equal-flex row (chess.com-style play chrome):
 * - `action` — icon above label (tab affordance)
 * - `button` — solid / outline / ghost {@link Button}
 */

import type { LocalizedString } from '@pkgs/i18n';
import type { ReactNode } from 'react';

import type { ComponentDataSet } from '../../component-id';
import type { ButtonIntent, ButtonVariant } from '../button';
import type { IconComponent } from '../icons';

export type BottomActionBarActionItem = {
  type: 'action';
  id: string;
  /** Visible under-icon caption (also a11y default when string). */
  label: ReactNode;
  icon: IconComponent;
  onPress: () => void;
  disabled?: boolean;
  /** Tint icon + label like an active tab. */
  selected?: boolean;
  accessibilityLabel?: LocalizedString;
  testID?: string;
};

export type BottomActionBarButtonItem = {
  type: 'button';
  id: string;
  title: ReactNode;
  onPress: () => void;
  intent?: ButtonIntent;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  /** Slot flex weight. Defaults to `1`. */
  flex?: number;
  testID?: string;
};

export type BottomActionBarItem =
  | BottomActionBarActionItem
  | BottomActionBarButtonItem;

export type BottomActionBarProps = {
  items: readonly BottomActionBarItem[];
  /**
   * Surface background + hairline top border (chess.com strip).
   * Defaults to `true`.
   */
  elevated?: boolean;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};
