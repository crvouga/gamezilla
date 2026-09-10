/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { ScreenBase } from './screen-base';

export default function ScreenBaseExample(): JSX.Element {
  return (
    <ExampleRoot class="flex-1 min-h-[400px]">
      <ScreenBase
        screenId="screen-base-example"
        breadcrumbs={[
          { name: 'Design system', onClick: () => undefined },
          { name: 'ScreenBase' },
        ]}
        actions={[
          { type: 'secondary', label: 'Secondary', onClick: () => undefined },
          { type: 'submit', label: 'Primary', onClick: () => undefined },
        ]}
        scroll
        content={({ bodyClass }) => (
          <div class="box" classList={{ [bodyClass]: !!bodyClass }}>
            <p class="text">
              {
                'Body content uses fixed padding from ScreenBase. On desktop, content sits in a card island under the page header.'
              }
            </p>
          </div>
        )}
      />
    </ExampleRoot>
  );
}
