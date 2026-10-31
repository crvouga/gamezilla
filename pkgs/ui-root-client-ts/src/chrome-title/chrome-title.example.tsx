/** @jsxImportSource solid-js */

import { ChromeTitle } from '@pkgs/ui-root-client-ts/chrome-title';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';

export default function ChromeTitleExample(): JSX.Element {
  return (
    <ExampleRoot>
      <ExampleSection title="navigationTitle (compact bar)">
        <Surface tone="surface" radius="control" padding="md">
          <ChromeTitle>{"Robin's space"}</ChromeTitle>
        </Surface>
      </ExampleSection>
      <ExampleSection title="subtitle (wide bar), clamped to one line">
        <Surface tone="surface" radius="control" padding="md" maxWidth="form">
          <ChromeTitle size="subtitle">
            {
              'Friday night chess with everyone from the office and their friends'
            }
          </ChromeTitle>
        </Surface>
      </ExampleSection>
    </ExampleRoot>
  );
}
