/** @jsxImportSource solid-js */

import { CodeBlock } from '@pkgs/ui-root-client-ts/code-block';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

const SNAPSHOT = JSON.stringify(
  { id: 'game_01', players: ['ada', 'grace'], clock: { initial: 300 } },
  null,
  2
);
const LONG_LINE =
  'Error: could not reach the room server after 3 attempts (last status 503, request 7f3a9c21-4be0-4d1f-9a55-0c2f6d1e8b77)';

export default function CodeBlockExample(): JSX.Element {
  return (
    <ExampleRoot>
      <SchemePreview>
        <ExampleSection title="framed (default): whitespace kept, long lines scroll">
          <CodeBlock aria-label="Snapshot">{SNAPSHOT}</CodeBlock>
          <StackVertical width="full" maxWidth="form">
            <CodeBlock>{LONG_LINE}</CodeBlock>
          </StackVertical>
        </ExampleSection>
        <ExampleSection title="wrap">
          <StackVertical width="full" maxWidth="form">
            <CodeBlock wrap>{LONG_LINE}</CodeBlock>
          </StackVertical>
        </ExampleSection>
        <ExampleSection title="framed false, on a surface">
          <Surface tone="surface" radius="card" border padding="md">
            <CodeBlock framed={false} wrap>
              {LONG_LINE}
            </CodeBlock>
          </Surface>
        </ExampleSection>
      </SchemePreview>
    </ExampleRoot>
  );
}
