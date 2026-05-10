/**
 * Tappable row inside {@link FloatingMenu}.
 * @internal Used only by {@link FloatingMenu}; not exported from `@gamezilla/ui`.
 */

import type { LocalizedString } from '@gamezilla/lib/i18n';
import type { ReactNode } from 'react';

import { Box } from '../box';
import { Pressable, type PressableProps } from '../pressable';
import { Text } from '../text';

export type FloatingMenuItemProps = Omit<
  PressableProps,
  'children' | 'accessibilityLabel'
> & {
  /** Primary label. */
  label: ReactNode;
  accessibilityLabel?: LocalizedString;
  /** Icon or node before the label. */
  leading?: ReactNode;
  /** Trailing control or metrics (aligned end). */
  trailing?: ReactNode;
};

export function FloatingMenuItem({
  label,
  leading,
  trailing,
  sx: sxProp,
  disabled,
  accessibilityLabel,
  ...rest
}: FloatingMenuItemProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      sx={{
        py: 3,
        px: 3,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        ...(disabled ? { opacity: 0.45 } : {}),
        ...sxProp,
      }}
      {...rest}
    >
      {leading}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Text
          variant="body"
          label={label}
          numberOfLines={1}
          ellipsizeMode="tail"
        />
      </Box>
      {trailing}
    </Pressable>
  );
}
