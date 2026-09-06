/**
 * `CloseIconButton` -- circular icon button rendering an X.
 *
 * Centralizes the "close" affordance for surfaces (modals, sheets) so every
 * dismiss control uses the same icon, size, paper fill, and accessibility
 * label.
 *
 * @example
 * ```tsx
 * <CloseIconButton onPress={onClose} />
 * ```
 */

import { useLingui } from '@lingui/react/macro';
import type { LocalizedString } from '@pkgs/i18n';
import type { ReactNode } from 'react';
import { type ComponentDataSet, componentDataSet } from '../../component-id';
import { useTheme } from '../../theme';
import { IconButton } from '../icon-button';
import { XIcon } from '../icons';

export type CloseIconButtonProps = {
  onPress: () => void;
  /** Diameter in pixels. Defaults to 44. */
  size?: number;
  /** Background color token or raw color. Defaults to `'surface'`. */
  background?: string;
  /** Label override. Defaults to localized "Close". */
  label?: LocalizedString;
  testID?: string;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

const ICON_SIZE_RATIO = 0.5;

export function CloseIconButton({
  onPress,
  size = 44,
  background = 'surface',
  label,
  testID,
  dataSet,
}: CloseIconButtonProps): ReactNode {
  const { t } = useLingui();
  const theme = useTheme();
  const iconSize = Math.round(size * ICON_SIZE_RATIO);
  const resolvedLabel = label ?? t`Close`;
  return (
    <IconButton
      size={size}
      background={background}
      onPress={onPress}
      label={resolvedLabel}
      accessibilityLabel={resolvedLabel}
      {...(testID !== undefined ? { testID } : {})}
      {...componentDataSet('CloseIconButton', dataSet)}
    >
      <XIcon size={iconSize} color={theme.colors.text} />
    </IconButton>
  );
}
