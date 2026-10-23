/** @jsxImportSource solid-js */
import { For, type JSX } from 'solid-js';
import { ExampleRoot } from './example-root';
import { ExampleSection } from './example-section';
import type { HeadingSize } from './heading';
import { H1, H2, H3, H4, H5, H6 } from './heading';
import { StackVertical } from './stack';
import { Text } from './text';

const SIZES: readonly HeadingSize[] = [
  'title',
  'heading',
  'subtitle',
  'navigationTitle',
  'label',
];

export default function HeadingExample(): JSX.Element {
  return (
    <ExampleRoot>
      <ExampleSection title="levels at their default size">
        <H1>{'H1 is title'}</H1>
        <H2>{'H2 is heading'}</H2>
        <H3>{'H3 is subtitle'}</H3>
        <H4>{'H4 is navigationTitle'}</H4>
        <H5>{'H5 is label'}</H5>
        <H6>{'H6 is label'}</H6>
      </ExampleSection>
      <ExampleSection title="size, on one level">
        <For each={SIZES}>{(size) => <H2 size={size}>{`H2 ${size}`}</H2>}</For>
      </ExampleSection>
      <ExampleSection title="tone, align, lines, numeral">
        <H3 tone="secondary">{'Secondary tone'}</H3>
        <H3 tone="tint">{'Tint tone'}</H3>
        <H3 align="center">{'Centered'}</H3>
        <H3 align="end">{'End aligned'}</H3>
        <StackVertical width="full" maxWidth="form">
          <H3 lines={1}>
            {'A heading that is far too long for its column and is clamped'}
          </H3>
          <H3 lines={2}>
            {
              'A heading that is far too long for its column and is clamped to two lines, however much more there is to say'
            }
          </H3>
        </StackVertical>
        <H2 numeral>{'1482'}</H2>
      </ExampleSection>
      <ExampleSection title="a run inside a heading keeps its type">
        <H2>
          {'Rating '}
          <Text variant="inherit" tone="success">
            {'+12'}
          </Text>
        </H2>
      </ExampleSection>
    </ExampleRoot>
  );
}
