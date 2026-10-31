/** @jsxImportSource solid-js */

import { Divider } from '@pkgs/ui-root-client-ts/divider';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import {
  ExampleSection,
  ExampleTile,
} from '../../storybook/fixtures/example-section';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

export default function DividerExample(): JSX.Element {
  return (
    <ExampleRoot>
      <SchemePreview>
        <ExampleSection title="horizontal, between items of a vertical stack">
          <StackVertical gap="md">
            <ExampleTile label="Above" />
            <Divider />
            <ExampleTile label="Below" />
          </StackVertical>
        </ExampleSection>
        <ExampleSection title="vertical, between items of a horizontal stack">
          <StackHorizontal gap="md">
            <ExampleTile label="Before" tall />
            <Divider orientation="vertical" />
            <ExampleTile label="After" tall />
          </StackHorizontal>
        </ExampleSection>
      </SchemePreview>
    </ExampleRoot>
  );
}
