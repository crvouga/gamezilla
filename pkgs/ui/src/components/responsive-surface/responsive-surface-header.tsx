/**
 * Shared header row for {@link ResponsiveSurface} (optional title + close).
 */

import type { ReactNode } from 'react';
import { Box } from '../box';
import { CloseIconButton } from '../close-icon-button';
import { Text } from '../text';

export type ResponsiveSurfaceHeaderProps = {
  /** When omitted, the row is close-only (X top-right). */
  title?: ReactNode;
  onClose: () => void;
};

export function ResponsiveSurfaceHeader({
  title,
  onClose,
}: ResponsiveSurfaceHeaderProps) {
  const hasTitle = title !== undefined && title !== null && title !== '';
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: hasTitle ? 'space-between' : 'flex-end',
        mb: 3,
        gap: 2,
      }}
    >
      {hasTitle ? (
        <Text
          variant="subtitle"
          label={title}
          numberOfLines={1}
          style={{ flex: 1, marginRight: 8 }}
        />
      ) : null}
      <CloseIconButton onPress={onClose} />
    </Box>
  );
}
