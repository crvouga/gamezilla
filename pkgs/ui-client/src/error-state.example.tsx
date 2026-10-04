/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { ExampleRoot } from './example-root';
import { SchemePreview } from './scheme-preview';
import { ErrorState } from './error-state';

function SectionLabel(props: { label: string }): JSX.Element {
  return (
    <label class="text textLabel text-text-secondary">{props.label}</label>
  );
}

export default function ErrorStateExample(): JSX.Element {
  return (
    <ExampleRoot>
      <SectionLabel label="Fill (full-screen failure)" />
      <SchemePreview>
        <div class="box h-70">
          <ErrorState
            title="Harness failed to start"
            body="UnknownDatabaseError: cannot open snapshot at /tmp/db.sqlite"
            retry={{ label: 'Try again', onClick: () => undefined }}
          />
        </div>
      </SchemePreview>

      <div class="divider" role="separator" />

      <SectionLabel label="Compact (inline card)" />
      <SchemePreview>
        <ErrorState
          variant="compact"
          title="Failed to load metrics"
          body="HTTP 503 — server temporarily unavailable"
        />
      </SchemePreview>

      <div class="divider" role="separator" />

      <SectionLabel label="Fill with copy (body present)" />
      <SchemePreview>
        <div class="box h-70">
          <ErrorState
            title="Failed to boot harness"
            body="no such table-valued function: pragma_table_info"
            copy={() => Promise.resolve()}
          />
        </div>
      </SchemePreview>

      <div class="divider" role="separator" />

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
