/** @jsxImportSource solid-js */

import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

function SectionLabel(props: { label: string }): JSX.Element {
  return <p class="text textSectionLabel">{props.label}</p>;
}

const noop = (): void => undefined;

export default function ErrorStateExample(): JSX.Element {
  return (
    <ExampleRoot>
      <p class="text textCaption">
        {
          'An error says what broke and what to do next, with the retry as the primary action. No exclamation marks, never a trip to support.'
        }
      </p>
      <SectionLabel label="Fill, with retry" />
      <SchemePreview>
        <div class="box h-70">
          <ErrorState
            title="Couldn't load your spaces"
            body="Check your connection and try again."
            retry={{ label: 'Try again', onClick: noop }}
          />
        </div>
      </SchemePreview>

      <div class="divider" role="separator" />

      <SectionLabel label="Fill, retry and a second recovery" />
      <SchemePreview>
        <div class="box h-80">
          <ErrorState
            title="This game didn't load"
            body="Try again, or go back to your games."
            retry={{ label: 'Try again', onClick: noop }}
            secondary={{ label: 'Back to games', onClick: noop }}
          />
        </div>
      </SchemePreview>

      <div class="divider" role="separator" />

      <SectionLabel label="Fill, with copy (body is text)" />
      <SchemePreview>
        <div class="box h-80">
          <ErrorState
            title="The harness didn't start"
            body="no such table-valued function: pragma_table_info"
            retry={{ label: 'Reload', onClick: noop }}
            copy={() => Promise.resolve()}
          />
        </div>
      </SchemePreview>

      <div class="divider" role="separator" />

      <SectionLabel label="Compact, with retry (default label)" />
      <SchemePreview>
        <ErrorState
          variant="compact"
          title="Sync paused"
          body="3 changes are waiting. Retry to send them."
          retry={{ onClick: noop }}
        />
      </SchemePreview>

      <div class="divider" role="separator" />

      <SectionLabel label="Compact, guidance only (a refusal)" />
      <SchemePreview>
        <ErrorState
          variant="compact"
          title="Friend request not sent"
          body="This person recently declined your request. Try again later."
        />
      </SchemePreview>

      <div class="divider" role="separator" />

      <SectionLabel label="Band (fixed-height slot)" />
      <SchemePreview>
        <div class="box h-40 panel">
          <ErrorState
            variant="band"
            title="Couldn't save"
            body="Your changes are still here. Try again."
            retry={{ label: 'Try again', onClick: noop }}
          />
        </div>
      </SchemePreview>
    </ExampleRoot>
  );
}
