/** @jsxImportSource solid-js */
import { createSignal, For, type JSX } from 'solid-js';
import { ExampleRoot } from './example-root';
import { ExampleSection } from './example-section';
import { Pane } from './pane';
import { StackHorizontal } from './stack';
import { P } from './text';

const COLUMNS = ['Alice', 'Bob', 'Carol'] as const;

export default function PaneExample(): JSX.Element {
  const [focused, setFocused] = createSignal<string>('Alice');
  return (
    <ExampleRoot>
      <ExampleSection title="Side-by-side panes; press one to focus it">
        <StackHorizontal gap="sm" minHeight="row">
          <For each={COLUMNS}>
            {(name) => (
              <Pane
                border
                tone="surface"
                focused={focused() === name}
                onActivate={() => setFocused(name)}
              >
                <P variant="caption" align="center">
                  {name}
                </P>
              </Pane>
            )}
          </For>
        </StackHorizontal>
      </ExampleSection>
      <ExampleSection title="A rounded pane in a list (a notebook cell)">
        <Pane grow={false} border radius="control" tone="surface">
          <P variant="mono">{'SELECT * FROM users LIMIT 10;'}</P>
        </Pane>
      </ExampleSection>
    </ExampleRoot>
  );
}
