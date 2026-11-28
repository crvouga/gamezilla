/** @jsxImportSource @solidjs/web */

import { SuccessState } from '@pkgs/ui-root-client-ts/success-state';
import type { JSX } from '@solidjs/web';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

export default function SuccessStateExample(): JSX.Element {
  return (
    <ExampleRoot>
      <label class="text textLabel text-text-secondary">
        {'Fill (post-step confirmation)'}
      </label>

      <div class="box h-70">
        <SuccessState
          title="Profile updated"
          body="Your changes will be visible to teammates after the next sync."
          action={{ label: 'Done', onClick: () => undefined }}
        />
      </div>

      <div class="divider" role="separator" />

      <label class="text textLabel text-text-secondary">
        {'Fill, title only'}
      </label>

      <div class="box h-60">
        <SuccessState title="All caught up" />
      </div>

      <div class="divider" role="separator" />

      <label class="text textLabel text-text-secondary">
        {'Compact (inline confirmation)'}
      </label>

      <SuccessState
        variant="compact"
        title="Server config updated"
        body="Local view updates after the next sync."
      />

      <div class="divider" role="separator" />

      <label class="text textLabel text-text-secondary">{'Title only'}</label>

      <div class="box gap-3">
        <SuccessState variant="compact" title="Saved" />
        <SuccessState
          variant="compact"
          title="Invite sent"
          body="They will get a notification."
          action={{ label: 'Send another', onClick: () => undefined }}
        />
      </div>
    </ExampleRoot>
  );
}
