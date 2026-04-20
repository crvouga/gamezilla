import { Box, Collapsible, useTheme } from '@gamezilla/shared/ui';
import type { ReactNode } from 'react';

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
