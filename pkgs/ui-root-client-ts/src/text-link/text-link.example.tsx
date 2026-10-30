/** @jsxImportSource solid-js */

import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { TextLinkTone } from '@pkgs/ui-root-client-ts/text-link';
import { TextLink } from '@pkgs/ui-root-client-ts/text-link';
import { For, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';

const TONES: readonly TextLinkTone[] = [
  'tint',
  'default',
  'secondary',
  'destructive',
];

export default function TextLinkExample(): JSX.Element {
  return (
    <ExampleRoot>
      <ExampleSection title="Inline, in a sentence">
        <P>
          {'By continuing you accept the '}
          <TextLink href="#terms">{'terms'}</TextLink>
          {'.'}
        </P>
      </ExampleSection>
      <ExampleSection title="Standalone, every tone">
        <StackVertical>
          <For each={TONES}>
            {(tone) => (
              <TextLink href={`#${tone}`} variant="standalone" tone={tone}>
                {`Tone ${tone}`}
              </TextLink>
            )}
          </For>
        </StackVertical>
      </ExampleSection>
      <ExampleSection title="External (new tab, outward arrow)">
        <TextLink href="https://example.com" external variant="standalone">
          {'Read the guide'}
        </TextLink>
      </ExampleSection>
      <ExampleSection title="Download">
        <TextLink
          href={`data:text/plain;charset=utf-8,${encodeURIComponent('Hello')}`}
          download="hello.txt"
          variant="standalone"
        >
          {'Download a file'}
        </TextLink>
      </ExampleSection>
      <ExampleSection title="Handled in place (onPress)">
        <TextLink href="#intercepted" onPress={() => undefined}>
          {'Handled in place'}
        </TextLink>
      </ExampleSection>
    </ExampleRoot>
  );
}
