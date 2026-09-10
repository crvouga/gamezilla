/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { Card } from '../card';
import { Divider } from '../divider';
import { ExampleRoot } from '../explorer/example-root';
import { SchemePreview } from '../explorer/scheme-preview';
import { LoadingState } from './loading-state';

export default function LoadingStateExample(): JSX.Element {
  return (
    <ExampleRoot>
      <label class="text textLabel text-text-secondary">
        {'Fill (default)'}
      </label>
      <SchemePreview>
        <div class="box h-[240px]">
          <LoadingState size="large" />
        </div>
      </SchemePreview>

      <Divider />

      <label class="text textLabel text-text-secondary">{'With caption'}</label>
      <SchemePreview>
        <div class="box h-[240px]">
          <LoadingState caption="Loading workspace…" />
        </div>
      </SchemePreview>

      <Divider />

      <label class="text textLabel text-text-secondary">
        {'Compact (inside a card)'}
      </label>
      <SchemePreview>
        <Card elevation={1}>
          <LoadingState
            variant="compact"
            caption="Waiting for metrics from server…"
          />
        </Card>
      </SchemePreview>
    </ExampleRoot>
  );
}
