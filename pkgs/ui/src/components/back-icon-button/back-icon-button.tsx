/**
 * `BackIconButton` -- circular icon button rendering a mirrored chevron.
 *
 * Centralizes the "back" affordance so every screen uses the same icon,
 * size, hit slop, and accessibility label.
 *
 * @example
 * ```tsx
 * <BackIconButton onPress={onBack} />
 * ```
 */

import type { LocalizedString } from '@pkgs/i18n';
import type { ReactNode } from 'react';

import { type ComponentDataSet, componentDataSet } from '../../component-id';
import { useTheme } from '../../theme';
import { useLingui } from '@lingui/react/macro';
import { releaseWebFocus } from '../../web/release-web-focus';
import { IconButton } from '../icon-button';
import { ChevronLeftIcon } from '../icons';

export type BackIconButtonProps = {
  onPress: () => void;
  /** Diameter in pixels. Defaults to 40. */
  size?: number;
  /** Background color token or raw color. Defaults to `'surface'`. */
  background?: string;
  /** Label override. Defaults to localized "Back". */
  label?: LocalizedString;
  testID?: string;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

const ICON_SIZE_RATIO = 0.5;

export function BackIconButton({
  onPress,
  size = 40,
  background = 'surface',
  label,
  testID,
  dataSet,
}: BackIconButtonProps): ReactNode {
  const { t } = useLingui();
  const theme = useTheme();
  const iconSize = Math.round(size * ICON_SIZE_RATIO);
  const resolvedLabel = label ?? t`Back`;
  return (
    <IconButton
      size={size}
      background={background}
      onPress={() => {
        releaseWebFocus();
        onPress();
      }}
      label={resolvedLabel}
      accessibilityLabel={resolvedLabel}
      {...(testID !== undefined ? { testID } : {})}
      {...componentDataSet('BackIconButton', dataSet)}
    >
      <ChevronLeftIcon size={iconSize} color={theme.colors.text} />
    </IconButton>
  );
}
