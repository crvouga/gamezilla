/** @jsxImportSource solid-js */

import { SuccessState } from '@pkgs/ui-root-client-ts/success-state';
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

export default function SuccessStateExample(): JSX.Element {
  return (
    <ExampleRoot>
      <label class="text textLabel text-text-secondary">
        {'Fill (post-step confirmation)'}
      </label>
      <SchemePreview>
        <div class="box h-70">
          <SuccessState
            title="Profile updated"
            body="Your changes will be visible to teammates after the next sync."
            action={{ label: 'Done', onClick: () => undefined }}
          />
        </div>
      </SchemePreview>

      <div class="divider" role="separator" />

      <label class="text textLabel text-text-secondary">
        {'Fill, title only'}
      </label>
      <SchemePreview>
        <div class="box h-60">
          <SuccessState title="All caught up" />
        </div>
      </SchemePreview>

      <div class="divider" role="separator" />

      <label class="text textLabel text-text-secondary">
        {'Compact (inline confirmation)'}
      </label>
      <SchemePreview>
        <SuccessState
          variant="compact"
          title="Server config updated"
          body="Local view updates after the next sync."
        />
      </SchemePreview>

      <div class="divider" role="separator" />

      <label class="text textLabel text-text-secondary">{'Title only'}</label>
      <SchemePreview>
        <div class="box gap-3">
          <SuccessState variant="compact" title="Saved" />
          <SuccessState
            variant="compact"
            title="Invite sent"
            body="They will get a notification."
            action={{ label: 'Send another', onClick: () => undefined }}
          />
        </div>
      </SchemePreview>
    </ExampleRoot>
  );
}
