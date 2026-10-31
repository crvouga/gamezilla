/** @jsxImportSource solid-js */
import { useLingui } from '@lingui/solid/macro';
import { PaginationControls } from '@pkgs/ui-root-client-ts/pagination-controls';
import { type JSX, Show } from 'solid-js';

/**
 * Controlled zero-based page navigation with a localized page count. Hidden when there are no rows; the caller owns loading the selected page.
 */
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
      <div class="box flex-row items-center justify-between gap-2 py-2 px-3 border-t border-border bg-surface">
        <p class="text textFootnote">{pageLabel()}</p>
        <PaginationControls
          pageIndex={props.pageIndex}
          pageCount={props.pageCount}
          onPageChange={props.onPageChange}
        />
      </div>
    </Show>
  );
}
