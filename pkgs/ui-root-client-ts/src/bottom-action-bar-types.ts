/**
 * Item + props types for `BottomActionBar`.
 *
 * Two slot kinds share one equal-flex row (chess.com-style play chrome):
 * - `action` — icon above label (tab affordance)
 * - `button` — solid / outline / ghost `Button`
 */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
import type { ButtonIntent, ButtonVariant } from './button-face';
import type { IconComponent } from './create-icon/index';

export type BottomActionBarActionItem = {
  type: 'action';
  id: string;
  /** Visible under-icon caption (also a11y default when string). */
  label: JSX.Element;
  icon: IconComponent;
  onClick: () => void;
  disabled?: boolean | undefined;
  /** Tint icon + label like an active tab. */
  selected?: boolean | undefined;
  'aria-label'?: string | undefined;
  dataSet?: ComponentDataSet | undefined;
};

export type BottomActionBarButtonItem = {
  type: 'button';
  id: string;
  title: JSX.Element;
  onClick: () => void;
  intent?: ButtonIntent | undefined;
  variant?: ButtonVariant | undefined;
  disabled?: boolean | undefined;
  loading?: boolean | undefined;
  startIcon?: JSX.Element | undefined;
  endIcon?: JSX.Element | undefined;
  /** Slot flex weight. Defaults to `1`. */
  flex?: number | undefined;
  dataSet?: ComponentDataSet | undefined;
};

export type BottomActionBarItem =
  | BottomActionBarActionItem
  | BottomActionBarButtonItem;

export type BottomActionBarProps = {
  items: readonly BottomActionBarItem[];
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};
