/**
 * Header block inside {@link FloatingMenu} (title + optional subtitle).
 * @internal Used only by {@link FloatingMenu}; not exported from `@pkgs/ui`.
 */

import type { ReactNode } from 'react';

import { Box } from '../box';
import { Text } from '../text';

export type FloatingMenuHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  avatar?: ReactNode;
  /** Extra rows below title (e.g. metadata). */
  children?: ReactNode;
};

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
          <Text variant="bodyBold" numberOfLines={1} label={title} />
          {hasSubtitle ? (
            <Text
              variant="caption"
              sx={{ color: 'textSecondary' }}
              label={subtitle}
            />
          ) : null}
        </Box>
      </Box>
      {children}
    </Box>
  );
}
