/** @jsxImportSource solid-js */
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { SchemePreview } from '../explorer/scheme-preview';
import { Stack } from '../stack';
import { Text } from '../text';
import { PaginationControls } from './pagination-controls';

const PAGE_COUNT = 12;

export default function PaginationControlsExample(): JSX.Element {
  const [pageIndex, setPageIndex] = createSignal(5);

  return (
    <ExampleRoot>
      <SchemePreview>
        <Stack spacing={3}>
          <Text
            variant="label"
            label="Circular Start / Prev / window / Next / End (12 pages)"
          />
          <PaginationControls
            pageIndex={pageIndex()}
            pageCount={PAGE_COUNT}
            onPageChange={setPageIndex}
          />
          <Text
            variant="caption"
            sx={{ opacity: 0.75 }}
            label={`Page ${pageIndex() + 1} of ${PAGE_COUNT}`}
          />
        </Stack>
      </SchemePreview>
    </ExampleRoot>
  );
}
