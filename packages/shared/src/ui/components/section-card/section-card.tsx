/**
 * `SectionCard` — bordered card wrapping a {@link Collapsible} disclosure.
 */

import type { ReactNode } from 'react';
import { Box } from '../box';
import { Collapsible } from '../collapsible';
import { useTheme } from '../../theme';

export type SectionCardProps = {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function SectionCard({
  title,
  defaultOpen = false,
  children,
}: SectionCardProps) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 2,
      }}
    >
      <Collapsible title={title} defaultOpen={defaultOpen}>
        <Box sx={{ paddingHorizontal: 3, paddingBottom: 3 }}>{children}</Box>
      </Collapsible>
    </Box>
  );
}
