/** @jsxImportSource solid-js */
import { For, type JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { ScreenBase } from '../screen-base';

const LINES = Array.from({ length: 12 }, (_, i) => i + 1);

export default function ScreenTitleExample(): JSX.Element {
  return (
    <ExampleRoot class="flex-1 min-h-100">
      <ScreenBase
        screenId="screen-title-example"
        largeTitle
        breadcrumbs={[
          { name: 'Design system', onClick: () => undefined },
          { name: 'ScreenLargeTitle' },
        ]}
        scroll
        content={({ bodyClass }) => (
          <div class={['box gap-3', bodyClass].filter(Boolean).join(' ')}>
            <p class="text textCaption">
              {
                'Scroll down — the TopBar title appears after the large title leaves the top.'
              }
            </p>
            <For each={LINES}>
              {(n) => <p class="text">{`Scroll content line ${n}`}</p>}
            </For>
          </div>
        )}
      />
    </ExampleRoot>
  );
}
