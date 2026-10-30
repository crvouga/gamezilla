/** @jsxImportSource solid-js */

import { PaginationControls } from '@pkgs/ui-root-client-ts/pagination-controls';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

const PAGE_COUNT = 12;

export default function PaginationControlsExample(): JSX.Element {
  const [pageIndex, setPageIndex] = createSignal(5);

  return (
    <ExampleRoot>
      <SchemePreview>
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
      </SchemePreview>
    </ExampleRoot>
  );
}
