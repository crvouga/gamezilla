/**
 * Header block inside {@link FloatingMenu} (title + optional subtitle).
 * @internal Used only by {@link FloatingMenu}; not exported from `@pkgs/ui`.
 */

import type { ReactNode } from 'react';

import { Box } from '../box';
import { Text, type TextVariant } from '../text';

export type FloatingMenuHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  avatar?: ReactNode;
  /** Extra rows below title (e.g. metadata). */
  children?: ReactNode;
};

function isTexty(node: ReactNode): node is string | number {
  return typeof node === 'string' || typeof node === 'number';
}

/** Strings go through {@link Text}; component titles render as-is (no Text-in-Text). */
function HeaderLine({
  value,
  variant,
  color,
}: {
  value: ReactNode;
  variant: TextVariant;
  color?: 'textSecondary';
}): ReactNode {
  if (isTexty(value)) {
    return (
      <Text
        variant={variant}
        numberOfLines={1}
        {...(color !== undefined ? { sx: { color } } : {})}
        label={value}
      />
    );
  }
  return value;
}

export function FloatingMenuHeader({
  title,
  subtitle,
  avatar,
  children,
}: FloatingMenuHeaderProps) {
  const hasSubtitle = subtitle !== undefined;
  const hasAvatar = avatar !== undefined;

  return (
    <Box
      sx={{
        px: 3,
        pb: 2,
        borderBottomWidth: 1,
        borderColor: 'border',
        gap: 0.5,
      }}
    >
      <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        {hasAvatar ? avatar : null}
        <Box sx={{ flex: 1, minWidth: 0, gap: 0.5 }}>
          <HeaderLine value={title} variant="bodyBold" />
          {hasSubtitle ? (
            <HeaderLine
              value={subtitle}
              variant="caption"
              color="textSecondary"
            />
          ) : null}
        </Box>
      </Box>
      {children}
    </Box>
  );
}
