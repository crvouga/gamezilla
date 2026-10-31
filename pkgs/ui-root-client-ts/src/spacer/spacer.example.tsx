/** @jsxImportSource solid-js */

import { Spacer } from '@pkgs/ui-root-client-ts/spacer';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import { SPACE_TOKENS } from '@pkgs/ui-root-shared-ts/token-names';
import { For, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import {
  ExampleSection,
  ExampleTile,
} from '../../storybook/fixtures/example-section';

export default function SpacerExample(): JSX.Element {
  return (
    <ExampleRoot>
      <ExampleSection title="Unsized: pushes the last tile to the end">
        <Surface
          tone="muted"
          radius="control"
          padding="sm"
          direction="horizontal"
          gap="sm"
        >
          <ExampleTile label="Back" />
          <Spacer />
          <ExampleTile label="Share" />
          <ExampleTile label="More" />
        </Surface>
      </ExampleSection>
      <ExampleSection title="Fixed size, per space token">
        <StackVertical gap="xs">
          <For each={SPACE_TOKENS}>
            {(size) => (
              <StackHorizontal align="center">
                <ExampleTile label={size} />
                <Spacer size={size} />
                <ExampleTile label="next" />
              </StackHorizontal>
            )}
          </For>
        </StackVertical>
      </ExampleSection>
      <ExampleSection title="In a column">
        <Surface tone="muted" radius="control" padding="sm">
          <ExampleTile label="Top" />
          <Spacer size="xl" />
          <ExampleTile label="After xl" />
        </Surface>
      </ExampleSection>
    </ExampleRoot>
  );
}
