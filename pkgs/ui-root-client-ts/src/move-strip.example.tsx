/** @jsxImportSource solid-js */
import { For, type JSX } from 'solid-js';
import { ExampleRoot } from './example-root';
import { ExampleSection } from './example-section';
import { MoveStrip } from './move-strip';
import { Pressable } from './pressable';
import { Code, P } from './text';

const MOVES = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6'];

export default function MoveStripExample(): JSX.Element {
  return (
    <ExampleRoot>
      <ExampleSection title="Moves between jump controls">
        <MoveStrip
          leading={<P variant="caption">{'«'}</P>}
          trailing={<P variant="caption">{'»'}</P>}
        >
          <For each={MOVES}>
            {(move) => (
              <Pressable radius="sm" paddingX="sm">
                <Code variant="label">{move}</Code>
              </Pressable>
            )}
          </For>
        </MoveStrip>
      </ExampleSection>
      <ExampleSection title="No moves yet: the row keeps its height">
        <MoveStrip />
      </ExampleSection>
    </ExampleRoot>
  );
}
