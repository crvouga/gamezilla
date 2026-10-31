/** @jsxImportSource solid-js */

import type { GridAlign, GridColumns } from '@pkgs/ui-root-client-ts/grid';
import { Grid } from '@pkgs/ui-root-client-ts/grid';
import { For, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import {
  ExampleSection,
  ExampleTile,
} from '../../storybook/fixtures/example-section';

const COLUMNS: readonly GridColumns[] = [1, 2, 3, 4, 6, 12];
const ALIGNS: readonly GridAlign[] = ['start', 'center', 'end', 'stretch'];
const CELLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export default function GridExample(): JSX.Element {
  return (
    <ExampleRoot>
      <For each={COLUMNS}>
        {(columns) => (
          <ExampleSection title={`columns ${columns}`}>
            <Grid columns={columns} gap="sm">
              <For each={CELLS}>
                {(cell) => <ExampleTile label={String(cell)} />}
              </For>
            </Grid>
          </ExampleSection>
        )}
      </For>
      <ExampleSection title="columns 1, 2 from sm, 3 from md, 4 from lg, 6 from xl; gap xs, lg from md">
        <Grid
          columns={{ base: 1, sm: 2, md: 3, lg: 4, xl: 6 }}
          gap={{ base: 'xs', md: 'lg' }}
        >
          <For each={CELLS}>
            {(cell) => <ExampleTile label={String(cell)} />}
          </For>
        </Grid>
      </ExampleSection>
      <For each={ALIGNS}>
        {(align) => (
          <ExampleSection title={`align ${align}`}>
            <Grid columns={3} gap="sm" align={align}>
              <ExampleTile label="Short" />
              <ExampleTile label="Tall" tall />
              <ExampleTile label="Short" />
            </Grid>
          </ExampleSection>
        )}
      </For>
    </ExampleRoot>
  );
}
