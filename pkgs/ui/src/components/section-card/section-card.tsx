/**
 * `SectionCard` — bordered card wrapping a {@link Collapsible} disclosure.
 */

import type { ReactNode } from 'react';
import { componentDataSet, type ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { Collapsible } from '../collapsible';
import { useTheme } from '../../theme';
import { borderRadius } from '../../theme/scale';

export type SectionCardProps = {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export function SectionCard({
  title,
  defaultOpen = false,
  children,
  dataSet,
}: SectionCardProps) {
  const theme = useTheme();
  return (
    <Box
      {...componentDataSet('SectionCard', dataSet)}
      sx={{
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: borderRadius.md,
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
