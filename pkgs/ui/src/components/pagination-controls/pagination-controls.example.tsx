import { useState } from 'react';
import { ExampleRoot } from '../explorer/example-root';
import { SchemePreview } from '../explorer/scheme-preview';
import { Stack } from '../stack';
import { Text } from '../text';
import { PaginationControls } from './pagination-controls';

export default function PaginationControlsExample() {
  const [pageIndex, setPageIndex] = useState(5);
  const pageCount = 12;

  return (
    <ExampleRoot>
      <SchemePreview>
        <Stack spacing={3}>
          <Text
            variant="label"
            label="Circular Start / Prev / window / Next / End (12 pages)"
          />
          <PaginationControls
            pageIndex={pageIndex}
            pageCount={pageCount}
            onPageChange={setPageIndex}
          />
          <Text
            variant="caption"
            sx={{ opacity: 0.75 }}
            label={`Page ${pageIndex + 1} of ${pageCount}`}
          />
        </Stack>
      </SchemePreview>
    </ExampleRoot>
  );
}
