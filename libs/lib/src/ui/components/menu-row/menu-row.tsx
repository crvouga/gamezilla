/**
 * `MenuRow` -- a tappable navigation row with title, optional caption, and a
 * trailing disclosure chevron.
 *
 * Designed for settings, menu, and "more" screens where each row routes to a
 * destination. Pair multiple `MenuRow`s in a vertical container.
 *
 * @example
 * ```tsx
 * <MenuRow
 *   title="Appearance"
 *   caption="Light, dark, or system theme"
 *   onPress={() => router.push('/more/theme')}
 * />
 * ```
 */

import type { LocalizedString } from '@gamezilla/lib/i18n';
import type { ReactNode } from 'react';
import { useTheme } from '../../theme';
import { Box } from '../box';
import { IconSymbol } from '../symbol-icon';
import { Pressable } from '../pressable';
import { Text } from '../text';

export type MenuRowProps = {
  title: ReactNode;
  caption?: ReactNode;
  /** Rendered before the title (e.g. an icon or avatar). */
  leading?: ReactNode;
  /** Replace the default trailing chevron with custom content. */
  trailing?: ReactNode;
  /** Hide the trailing disclosure chevron. Defaults to `false`. */
  hideChevron?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: LocalizedString;
};

export function MenuRow({
  title,
  caption,
  leading,
  trailing,
  hideChevron = false,
  onPress,
  disabled = false,
  testID,
  accessibilityLabel,
}: MenuRowProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Box
        sx={{
          flexDirection: 'row',
          alignItems: 'center',
          py: 3,
          gap: 3,
        }}
      >
        {leading}
        <Box sx={{ flex: 1, gap: 1 }}>
          <Text variant="bodyBold" label={title} />
          {caption ? <Text variant="caption" label={caption} /> : null}
        </Box>
        {trailing ??
          (hideChevron ? null : (
            <IconSymbol
              name="chevron.right"
              size={20}
              color={theme.colors.icon}
            />
          ))}
      </Box>
    </Pressable>
  );
}
