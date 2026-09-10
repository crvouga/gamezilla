/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { Island } from '../island';
import { IslandGrid } from './island-grid';

export default function IslandGridExample(): JSX.Element {
  return (
    <ExampleRoot>
      <IslandGrid columns={3}>
        <Island span={1} title="Identity">
          <p class="text">{'Avatar + username'}</p>
        </Island>
        <Island span={2} title="Friends">
          <p class="text">{'Friends stats and actions'}</p>
        </Island>
      </IslandGrid>
    </ExampleRoot>
  );
}
