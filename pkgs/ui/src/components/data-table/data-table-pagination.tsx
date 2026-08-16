import type { ReactNode } from 'react';

import { Box } from '../box';
import { Button } from '../button';
import { Text } from '../text';

export function DataTablePagination(props: {
  readonly pageIndex: number;
  readonly pageCount: number;
  readonly totalCount: number;
  readonly onPrev: () => void;
  readonly onNext: () => void;
}): ReactNode {
  const { pageIndex, pageCount, totalCount, onPrev, onNext } = props;
  if (totalCount === 0) {
    return null;
  }
  const pageLabel = `Page ${pageIndex + 1} of ${pageCount}`;
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 2,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderTopWidth: 'hairline',
        borderColor: 'border',
        backgroundColor: 'surface',
      }}
    >
      <Text sx={{ color: 'textSecondary', fontSize: 12 }} label={pageLabel} />
      <Button
        title="Prev"
        size="sm"
        intent="neutral"
        variant="outline"
        disabled={pageIndex <= 0}
        onPress={onPrev}
      />
      <Button
        title="Next"
        size="sm"
        intent="neutral"
        variant="outline"
        disabled={pageIndex >= pageCount - 1}
        onPress={onNext}
      />
    </Box>
  );
}
