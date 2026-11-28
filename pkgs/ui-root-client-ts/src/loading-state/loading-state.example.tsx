/** @jsxImportSource @solidjs/web */

import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import type { JSX } from '@solidjs/web';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

export default function LoadingStateExample(): JSX.Element {
  return (
    <ExampleRoot>
      <label class="text textLabel text-text-secondary">
        {'Fill (default)'}
      </label>

      <div class="box h-60">
        <LoadingState size="lg" />
      </div>

      <div class="divider" role="separator" />

      <label class="text textLabel text-text-secondary">{'With caption'}</label>

      <div class="box h-60">
        <LoadingState caption="Loading workspace…" />
      </div>

      <div class="divider" role="separator" />

      <label class="text textLabel text-text-secondary">
        {'Compact (inside a card)'}
      </label>

      <div class="panel">
        <LoadingState
          variant="compact"
          caption="Waiting for metrics from server…"
        />
      </div>
    </ExampleRoot>
  );
}
