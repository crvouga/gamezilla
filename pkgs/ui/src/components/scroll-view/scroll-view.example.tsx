/** @jsxImportSource solid-js */
import { For, type JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { ScrollView } from './scroll-view';

const ITEMS = Array.from({ length: 20 }, (_, i) => i + 1);

export default function ScrollViewExample(): JSX.Element {
  return (
    <ExampleRoot>
      <div class="box h-50 border border-solid border-border rounded-lg">
        <ScrollView
          contentStyle={{
            padding: 'var(--ui-space-3)',
            gap: 'var(--ui-space-2)',
          }}
        >
          <For each={ITEMS}>
            {(n) => (
              <div class="box p-3 bg-surface rounded-md">
                <p class="text">{`Item ${n}`}</p>
              </div>
            )}
          </For>
        </ScrollView>
      </div>
    </ExampleRoot>
  );
}
