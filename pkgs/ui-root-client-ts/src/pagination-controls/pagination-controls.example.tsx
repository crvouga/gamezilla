/** @jsxImportSource @solidjs/web */

import { PaginationControls } from '@pkgs/ui-root-client-ts/pagination-controls';
import type { JSX } from '@solidjs/web';
import { createSignal } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

const PAGE_COUNT = 12;

export default function PaginationControlsExample(): JSX.Element {
  const [pageIndex, setPageIndex] = createSignal(5);

  return (
    <ExampleRoot>
      <div class="box flex-col gap-3">
        <label class="text textLabel">
          {'Circular Start / Prev / window / Next / End (12 pages)'}
        </label>
        <PaginationControls
          pageIndex={pageIndex()}
          pageCount={PAGE_COUNT}
          onPageChange={setPageIndex}
        />
        <p class="text textCaption opacity-75">{`Page ${pageIndex() + 1} of ${PAGE_COUNT}`}</p>
      </div>
    </ExampleRoot>
  );
}
