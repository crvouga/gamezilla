/**
 * Tappable row inside {@link FloatingMenu}.
 * @internal Used only by {@link FloatingMenu}; not exported from `@pkgs/ui`.
 */

import type { LocalizedString } from '@pkgs/i18n';
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
  /** Secondary line under the label (e.g. email). */
  subtitle?: ReactNode;
  accessibilityLabel?: LocalizedString;
  /** Icon or node before the label. */
  leading?: ReactNode;
  /** Trailing control or metrics (aligned end). */
  trailing?: ReactNode;
};

export function FloatingMenuItem({
  label,
  subtitle,
  leading,
  trailing,
  sx: sxProp,
  disabled,
  accessibilityLabel,
  ...rest
}: FloatingMenuItemProps) {
  const hasSubtitle = subtitle !== undefined;
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
      <Box sx={{ flex: 1, minWidth: 0, gap: 0.5 }}>
        <Text
          variant="body"
          label={label}
          numberOfLines={1}
          ellipsizeMode="tail"
        />
        {hasSubtitle ? (
          <Text
            variant="caption"
            sx={{ color: 'textSecondary' }}
            label={subtitle}
            numberOfLines={1}
            ellipsizeMode="tail"
          />
        ) : null}
      </Box>
      {trailing}
    </Pressable>
  );
}
