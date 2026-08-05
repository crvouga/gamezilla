/**
 * `MenuRow` -- a tappable navigation row with title, optional caption, and a
 * trailing disclosure chevron.
 *
 * Hover (web) and press tints come automatically from {@link Pressable}'s
 * default `'tint'` feedback. Pass `selected` to opt into a `tintSubtle` row
 * fill for "current section" / multi-select patterns.
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

import type { LocalizedString } from '@pkgs/i18n';
import type { ReactNode } from 'react';
import { componentDataSet, type ComponentDataSet } from '../../component-id';
import { useTheme } from '../../theme';
import { borderRadius } from '../../theme/scale';
import { releaseWebFocus } from '../../web/release-web-focus';
import { Box } from '../box';
import { Pressable } from '../pressable';
import { ChevronRightIcon } from '../icons';
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
  /** Render the row in its "current selection" state. */
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: LocalizedString;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export function MenuRow({
  title,
  caption,
  leading,
  trailing,
  hideChevron = false,
  selected = false,
  onPress,
  disabled = false,
  testID,
  accessibilityLabel,
  dataSet,
}: MenuRowProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={
        onPress === undefined
          ? undefined
          : () => {
              releaseWebFocus();
              onPress();
            }
      }
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      sx={{ borderRadius: borderRadius.md }}
      style={{
        borderRadius: borderRadius.md,
        backgroundColor: selected ? theme.colors.tintSubtle : undefined,
      }}
      {...componentDataSet('MenuRow', dataSet)}
    >
      <Box
        sx={{
          flexDirection: 'row',
          alignItems: 'center',
          px: 3,
          py: 3,
          gap: 3,
        }}
      >
        {leading}
        <Box sx={{ flex: 1, gap: 1 }}>
          {selected ? (
            <Text variant="bodyBold" sx={{ color: 'tint' }} label={title} />
          ) : (
            <Text variant="bodyBold" label={title} />
          )}
          {caption ? <Text variant="caption" label={caption} /> : null}
        </Box>
        {trailing ??
          (hideChevron ? null : (
            <ChevronRightIcon
              size={20}
              color={selected ? theme.colors.tint : theme.colors.icon}
            />
          ))}
      </Box>
    </Pressable>
  );
}
