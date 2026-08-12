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
  /** `testID` for the header close control. */
  closeTestID?: string;
};

export function ResponsiveSurfaceHeader({
  title,
  onClose,
  closeTestID,
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
          sx={{ flex: 1, mr: 2 }}
        />
      ) : null}
      <CloseIconButton
        onPress={onClose}
        {...(closeTestID !== undefined ? { testID: closeTestID } : {})}
      />
    </Box>
  );
}
