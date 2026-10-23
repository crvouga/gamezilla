/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { ExampleRoot } from './example-root';
import { LoadingState } from './loading-state';
import { SchemePreview } from './scheme-preview';

export default function LoadingStateExample(): JSX.Element {
  return (
    <ExampleRoot>
      <label class="text textLabel text-text-secondary">
        {'Fill (default)'}
      </label>
      <SchemePreview>
        <div class="box h-60">
          <LoadingState size="lg" />
        </div>
      </SchemePreview>

      <div class="divider" role="separator" />

      <label class="text textLabel text-text-secondary">{'With caption'}</label>
      <SchemePreview>
        <div class="box h-60">
          <LoadingState caption="Loading workspace…" />
        </div>
      </SchemePreview>

      <div class="divider" role="separator" />

      <label class="text textLabel text-text-secondary">
        {'Compact (inside a card)'}
      </label>
      <SchemePreview>
        <div class="panel">
          <LoadingState
            variant="compact"
            caption="Waiting for metrics from server…"
          />
        </div>
      </SchemePreview>
    </ExampleRoot>
  );
}
