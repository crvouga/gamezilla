/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { ChromeTitle } from './chrome-title';
import { ExampleRoot } from './example-root';
import { ExampleSection } from './example-section';
import { Surface } from './surface';

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
