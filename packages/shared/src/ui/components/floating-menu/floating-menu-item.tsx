/**
 * Tappable row inside {@link FloatingMenu}.
 * @internal Used only by {@link FloatingMenu}; not exported from `@gamezilla/shared/ui`.
 */

import type { ReactNode } from 'react';

import { Pressable, type PressableProps } from '../pressable';
import { Text } from '../text';

export type FloatingMenuItemProps = Omit<
  PressableProps,
  'children'
> & {
  /** Primary label. */
  label: string;
  /** Icon or node before the label. */
  leading?: ReactNode;
};

export function FloatingMenuItem({
  label,
  leading,
  sx: sxProp,
  disabled,
  accessibilityLabel,
  ...rest
}: FloatingMenuItemProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
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
      <Text variant="body">{label}</Text>
    </Pressable>
  );
}
