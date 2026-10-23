/** @jsxImportSource solid-js */
import { For, type JSX } from 'solid-js';
import { ExampleRoot } from './example-root';
import { ExampleSection } from './example-section';
import { StackVertical } from './stack';
import { P } from './text';
import type { TextLinkTone } from './text-link';
import { TextLink } from './text-link';

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
