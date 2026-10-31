/** @jsxImportSource solid-js */

import { ScreenBase } from '@pkgs/ui-root-client-ts/screen-base';
import { For, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

const LINES = Array.from({ length: 12 }, (_, i) => i + 1);

export default function ScreenTitleExample(): JSX.Element {
  return (
    <ExampleRoot grow minHeight="lg">
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
