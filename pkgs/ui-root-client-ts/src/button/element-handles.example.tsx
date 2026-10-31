/** @jsxImportSource solid-js */

import { Button } from '@pkgs/ui-root-client-ts/button';
import { createFocusTarget } from '@pkgs/ui-root-client-ts/focus';
import { createMeasure } from '@pkgs/ui-root-client-ts/measure';
import { Pressable } from '@pkgs/ui-root-client-ts/pressable';
import { createScrollTarget } from '@pkgs/ui-root-client-ts/scroll';
import { ScrollView } from '@pkgs/ui-root-client-ts/scroll-view';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import { createEffect, createSignal, For, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import {
  ExampleSection,
  ExampleTile,
} from '../../storybook/fixtures/example-section';

const MOVES = [
  'e4',
  'e5',
  'Nf3',
  'Nc6',
  'Bb5',
  'a6',
  'Ba4',
  'Nf6',
  'O-O',
  'Be7',
  'Re1',
  'b5',
  'Bb3',
  'd6',
  'c3',
  'O-O',
] as const;

function FocusExample(): JSX.Element {
  const [name, setName] = createSignal('');
  const field = createFocusTarget();
  const region = createFocusTarget();
  return (
    <ExampleSection title="createFocusTarget: focus a field, focus a region">
      <TextInput
        focusTarget={field.target}
        value={name()}
        onChangeText={setName}
        label="Name"
      />
      <Pressable focusTarget={region.target} padding="md" radius="control">
        <P variant="label">{'A pressable region'}</P>
      </Pressable>
      <StackHorizontal gap="sm">
        <Button title="Focus the field" onClick={() => field.focus()} />
        <Button
          title="Focus the region"
          intent="neutral"
          variant="outline"
          onClick={() => region.focus()}
        />
      </StackHorizontal>
    </ExampleSection>
  );
}

function ScrollExample(): JSX.Element {
  const [selected, setSelected] = createSignal(0);
  const current = createScrollTarget();
  createEffect(() => {
    selected();
    current.scrollIntoView({ inline: 'center', block: 'nearest' });
  });
  return (
    <ExampleSection title="createScrollTarget: the selected move scrolls into view">
      <StackVertical width="full" maxWidth="form" gap="sm">
        <ScrollView horizontal hideScrollbar>
          <StackHorizontal gap="xs">
            <For each={MOVES}>
              {(move, index) => (
                <StackHorizontal
                  scrollTarget={
                    index() === selected() ? current.target : undefined
                  }
                >
                  <Surface
                    tone={index() === selected() ? 'success' : 'muted'}
                    radius="sm"
                    paddingX="sm"
                    paddingY="xs"
                  >
                    <Text variant="label" numeral>
                      {move}
                    </Text>
                  </Surface>
                </StackHorizontal>
              )}
            </For>
          </StackHorizontal>
        </ScrollView>
        <StackHorizontal gap="sm">
          <Button
            title="Previous"
            intent="neutral"
            variant="outline"
            size="sm"
            onClick={() => setSelected((at) => Math.max(0, at - 1))}
          />
          <Button
            title="Next"
            size="sm"
            onClick={() =>
              setSelected((at) => Math.min(MOVES.length - 1, at + 1))
            }
          />
        </StackHorizontal>
      </StackVertical>
    </ExampleSection>
  );
}

function MeasureExample(): JSX.Element {
  const frame = createMeasure();
  return (
    <ExampleSection title="createMeasure: the rendered size of a stack">
      <Surface tone="muted" radius="control">
        <StackVertical
          measureTarget={frame.target}
          padding="lg"
          gap="xs"
          testId="element-handles-example-measured"
        >
          <ExampleTile label="Measured stack" />
          <P variant="caption" numeral>
            {`${frame.width()} × ${frame.height()}`}
          </P>
        </StackVertical>
      </Surface>
    </ExampleSection>
  );
}

export default function ElementHandlesExample(): JSX.Element {
  return (
    <ExampleRoot>
      <FocusExample />
      <ScrollExample />
      <MeasureExample />
    </ExampleRoot>
  );
}
