import type { LocalizedString } from '@gamezilla/i18n';
import type { ReactNode } from 'react';

import type { IconSymbolName } from '../symbol-icon';

/** Header block above menu rows. */
export type FloatingMenuHeaderSpec = {
  title: ReactNode;
  subtitle?: ReactNode;
};

export type FloatingMenuItemRow = {
  type: 'item';
  /** Stable React key and a11y id. */
  id: string;
  label: ReactNode;
  icon: IconSymbolName;
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
  header: FloatingMenuHeaderSpec;
  rows: FloatingMenuContentRow[];
};
