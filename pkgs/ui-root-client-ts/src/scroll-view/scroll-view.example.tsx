/** @jsxImportSource solid-js */

import { ScrollView } from '@pkgs/ui-root-client-ts/scroll-view';
import { For, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

const ITEMS = Array.from({ length: 20 }, (_, i) => i + 1);

export default function ScrollViewExample(): JSX.Element {
  return (
    <ExampleRoot>
      <div class="box h-50 border border-solid border-border rounded-sm">
        <ScrollView padding="md" gap="sm">
          <For each={ITEMS}>
            {(n) => (
              <div class="box p-3 bg-surface rounded-sm">
                <p class="text">{`Item ${n}`}</p>
              </div>
            )}
          </For>
        </ScrollView>
      </div>
    </ExampleRoot>
  );
}
