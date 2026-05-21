/**
 * `BackIconButton` -- circular icon button rendering a mirrored chevron.
 *
 * Centralizes the "back" affordance so every screen uses the same icon,
 * size, hit slop, and accessibility label. Mirrors the registry's
 * `chevron.right` icon along the X axis since the design system does not
 * ship a dedicated `chevron.left` glyph.
 *
 * @example
 * ```tsx
 * <BackIconButton onPress={onBack} />
 * ```
 */

import type { LocalizedString } from '@pkgs/i18n';
import type { ReactNode } from 'react';

import { useTheme } from '../../theme';
import { useLingui } from '@lingui/react/macro';
import { IconButton } from '../icon-button';
import { IconSymbol } from '../symbol-icon';

export type BackIconButtonProps = {
  onPress: () => void;
  /** Diameter in pixels. Defaults to 40. */
  size?: number;
  /** Background color token or raw color. Defaults to `'surface'`. */
  background?: string;
  /** Accessibility label override. Defaults to localized "Back". */
  accessibilityLabel?: LocalizedString;
  testID?: string;
};

const ICON_SIZE_RATIO = 0.5;

export function BackIconButton({
  onPress,
  size = 40,
  background = 'surface',
  accessibilityLabel,
  testID,
}: BackIconButtonProps): ReactNode {
  const { t } = useLingui();
  const theme = useTheme();
  const iconSize = Math.round(size * ICON_SIZE_RATIO);
  return (
    <IconButton
      size={size}
      background={background}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? t`Back`}
      {...(testID !== undefined ? { testID } : {})}
    >
      <IconSymbol
        name="chevron.right"
        size={iconSize}
        color={theme.colors.text}
        style={{ transform: [{ scaleX: -1 }] }}
      />
    </IconButton>
  );
}
