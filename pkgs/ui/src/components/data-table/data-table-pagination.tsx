/** @jsxImportSource solid-js */
import { useLingui } from '@lingui/solid/macro';
import { type JSX, Show } from 'solid-js';

import { Box } from '../box';
import { PaginationControls } from '../pagination-controls';
import { Text } from '../text';

export function DataTablePagination(props: {
  readonly pageIndex: number;
  readonly pageCount: number;
  readonly totalCount: number;
  readonly onPageChange: (pageIndex: number) => void;
}): JSX.Element {
  const { t } = useLingui();
  const pageLabel = () => {
    const current = props.pageIndex + 1;
    const total = props.pageCount;
    return t`Page ${current} of ${total}`;
  };
  return (
    <Show when={props.totalCount > 0}>
      <Box
        sx={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          py: 2,
          px: 3,
          borderTopWidth: 'hairline',
          borderColor: 'border',
          backgroundColor: 'surface',
        }}
      >
        <Text
          sx={{ color: 'textSecondary', fontSize: 12 }}
          label={pageLabel()}
        />
        <PaginationControls
          pageIndex={props.pageIndex}
          pageCount={props.pageCount}
          onPageChange={props.onPageChange}
        />
      </Box>
    </Show>
  );
}
