/** @jsxImportSource solid-js */

import { MoveStrip } from '@pkgs/ui-root-client-ts/move-strip';
import { Pressable } from '@pkgs/ui-root-client-ts/pressable';
import { Code, P } from '@pkgs/ui-root-client-ts/text';
import { For, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';

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
