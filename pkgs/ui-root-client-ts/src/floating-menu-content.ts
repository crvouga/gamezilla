import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
import type { IconComponent } from './create-icon/index';

/** Header block above menu rows. */
export type FloatingMenuHeaderSpec = {
  title: JSX.Element;
  subtitle?: JSX.Element | undefined;
  /** Optional avatar beside title/subtitle. */
  avatar?: JSX.Element | undefined;
  /** Optional status chip on its own row under the title (e.g. a plan tier). */
  badge?: JSX.Element | undefined;
};

export type FloatingMenuItemRow = {
  type: 'item';
  /** Stable key and a11y id. */
  id: string;
  label: JSX.Element;
  /** Secondary line under the label (e.g. email). */
  subtitle?: JSX.Element | undefined;
  icon: IconComponent;
  /** When set, replaces the default icon glyph (e.g. account avatar). */
  leading?: JSX.Element | undefined;
  /** Right-aligned content (e.g. status + metrics). */
  trailing?: JSX.Element | undefined;
  onClick?: (() => void) | undefined;
  disabled?: boolean | undefined;
  'aria-label'?: string | undefined;
  /** DOM `data-*` identifiers for the row button. */
  dataSet?: ComponentDataSet | undefined;
};

export type FloatingMenuDividerRow = {
  type: 'divider';
  id: string;
};

export type FloatingMenuContentRow =
  | FloatingMenuItemRow
  | FloatingMenuDividerRow;

/** Declarative body for {@link FloatingMenu}. */
export type FloatingMenuContent = {
  /** Optional panel header (title + optional subtitle). Omit for a flat action list. */
  header?: FloatingMenuHeaderSpec | undefined;
  rows: readonly FloatingMenuContentRow[];
};
