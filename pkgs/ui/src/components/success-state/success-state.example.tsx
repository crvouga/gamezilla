/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { SchemePreview } from '../explorer/scheme-preview';
import { SuccessState } from './success-state';

export default function SuccessStateExample(): JSX.Element {
  return (
    <ExampleRoot>
      <label class="text textLabel text-text-secondary">
        {'Fill (post-step confirmation)'}
      </label>
      <SchemePreview>
        <div class="box h-[280px]">
          <SuccessState
            title="Profile updated"
            body="Your changes will be visible to teammates after the next sync."
            action={{ label: 'Done', onClick: () => undefined }}
          />
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
        <SuccessState variant="compact" title="Saved" />
      </SchemePreview>
    </ExampleRoot>
  );
}
