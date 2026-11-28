/** @jsxImportSource @solidjs/web */

import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import type { JSX } from '@solidjs/web';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

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

      <div class="box h-70">
        <ErrorState
          title="Couldn't load your spaces"
          body="Check your connection and try again."
          retry={{ label: 'Try again', onClick: noop }}
        />
      </div>

      <div class="divider" role="separator" />

      <SectionLabel label="Fill, retry and a second recovery" />

      <div class="box h-80">
        <ErrorState
          title="This game didn't load"
          body="Try again, or go back to your games."
          retry={{ label: 'Try again', onClick: noop }}
          secondary={{ label: 'Back to games', onClick: noop }}
        />
      </div>

      <div class="divider" role="separator" />

      <SectionLabel label="Fill, with copy (body is text)" />

      <div class="box h-80">
        <ErrorState
          title="The harness didn't start"
          body="no such table-valued function: pragma_table_info"
          retry={{ label: 'Reload', onClick: noop }}
          copy={() => Promise.resolve()}
        />
      </div>

      <div class="divider" role="separator" />

      <SectionLabel label="Compact, with retry (default label)" />

      <ErrorState
        variant="compact"
        title="Sync paused"
        body="3 changes are waiting. Retry to send them."
        retry={{ onClick: noop }}
      />

      <div class="divider" role="separator" />

      <SectionLabel label="Compact, guidance only (a refusal)" />

      <ErrorState
        variant="compact"
        title="Friend request not sent"
        body="This person recently declined your request. Try again later."
      />

      <div class="divider" role="separator" />

      <SectionLabel label="Band (fixed-height slot)" />

      <div class="box h-40 panel">
        <ErrorState
          variant="band"
          title="Couldn't save"
          body="Your changes are still here. Try again."
          retry={{ label: 'Try again', onClick: noop }}
        />
      </div>
    </ExampleRoot>
  );
}
