/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { Box } from '../box';
import { Divider } from '../divider';
import { ExampleRoot } from '../explorer/example-root';
import { SchemePreview } from '../explorer/scheme-preview';
import { Text } from '../text';
import { ErrorState } from './error-state';

function SectionLabel(props: { label: string }): JSX.Element {
  return (
    <Text variant="label" sx={{ color: 'textSecondary' }} label={props.label} />
  );
}

export default function ErrorStateExample(): JSX.Element {
  return (
    <ExampleRoot>
      <SectionLabel label="Fill (full-screen failure)" />
      <SchemePreview>
        <Box sx={{ height: 280 }}>
          <ErrorState
            title="Playground failed to start"
            body="UnknownDatabaseError: cannot open snapshot at /tmp/db.sqlite"
            retry={{ label: 'Try again', onClick: () => undefined }}
          />
        </Box>
      </SchemePreview>

      <Divider />

      <SectionLabel label="Compact (inline card)" />
      <SchemePreview>
        <ErrorState
          variant="compact"
          title="Failed to load metrics"
          body="HTTP 503 — server temporarily unavailable"
        />
      </SchemePreview>

      <Divider />

      <SectionLabel label="Fill with copy (body present)" />
      <SchemePreview>
        <Box sx={{ height: 280 }}>
          <ErrorState
            title="Failed to boot playground"
            body="no such table-valued function: pragma_table_info"
            copy={() => Promise.resolve()}
          />
        </Box>
      </SchemePreview>

      <Divider />

      <SectionLabel label="Compact with retry" />
      <SchemePreview>
        <ErrorState
          variant="compact"
          title="Sync failed"
          body="Could not apply 3 pending patches"
          retry={{ onClick: () => undefined }}
        />
      </SchemePreview>
    </ExampleRoot>
  );
}
