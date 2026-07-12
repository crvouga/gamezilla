import type { LocalizedString } from '@pkgs/i18n';
import type { ReactNode } from 'react';

import type { IconComponent } from '../icons';

/** Header block above menu rows. */
export type FloatingMenuHeaderSpec = {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Optional avatar beside title/subtitle. */
  avatar?: ReactNode;
};

export type FloatingMenuItemRow = {
  type: 'item';
  /** Stable React key and a11y id. */
  id: string;
  label: ReactNode;
  icon: IconComponent;
  /** Right-aligned content (e.g. status + metrics). */
  trailing?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: LocalizedString;
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
  header?: FloatingMenuHeaderSpec;
  rows: FloatingMenuContentRow[];
};
