import { Box } from '@gamezilla/shared/ui';
import { useTheme } from '@gamezilla/shared/theme';
import type { ReactNode } from 'react';

/** Max width for main column on tablet/desktop (dp / CSS px). */
const MAX_CONTENT_WIDTH = 1120;

export type ConstrainedContentProps = {
  children: ReactNode;
};

/**
 * Centers and caps content width on tablet/desktop; full width on mobile.
 */
export function ConstrainedContent({ children }: ConstrainedContentProps) {
  const theme = useTheme();
  const wide = theme.breakpoint !== 'mobile';

  return (
    <Box
      sx={{
        flex: 1,
        ...(wide
          ? { alignSelf: 'center' as const, maxWidth: MAX_CONTENT_WIDTH }
          : {}),
      }}
      style={{ width: '100%' }}
    >
      {children}
    </Box>
  );
}
