import type { ReactNode } from 'react';

import { Box } from '../box';
import { PaginationControls } from '../pagination-controls';
import { Text } from '../text';

export function DataTablePagination(props: {
  readonly pageIndex: number;
  readonly pageCount: number;
  readonly totalCount: number;
  readonly onPageChange: (pageIndex: number) => void;
}): ReactNode {
  const { pageIndex, pageCount, totalCount, onPageChange } = props;
  if (totalCount === 0) {
    return null;
  }
  const pageLabel = `Page ${pageIndex + 1} of ${pageCount}`;
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderTopWidth: 'hairline',
        borderColor: 'border',
        backgroundColor: 'surface',
      }}
    >
      <Text sx={{ color: 'textSecondary', fontSize: 12 }} label={pageLabel} />
      <PaginationControls
        pageIndex={pageIndex}
        pageCount={pageCount}
        onPageChange={onPageChange}
      />
    </Box>
  );
}
