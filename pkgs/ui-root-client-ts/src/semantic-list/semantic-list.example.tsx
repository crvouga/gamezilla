/** @jsxImportSource solid-js */

import { Grid } from '@pkgs/ui-root-client-ts/grid';
import {
  ListEntry,
  OrderedList,
  UnorderedList,
} from '@pkgs/ui-root-client-ts/semantic-list';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { For, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import {
  ExampleSection,
  ExampleTile,
} from '../../storybook/fixtures/example-section';

const GAMES = ['Chess', 'Checkers', 'Go', 'Hex'] as const;
const STEPS = ['Open', 'Middle game', 'End game'] as const;

export default function SemanticListExample(): JSX.Element {
  return (
    <ExampleRoot>
      <ExampleSection title="UnorderedList: the stack is outside, each entry holds one item">
        <StackVertical gap="xs">
          <UnorderedList aria-label="Games">
            <For each={GAMES}>
              {(game) => (
                <ListEntry>
                  <ExampleTile label={game} />
                </ListEntry>
              )}
            </For>
          </UnorderedList>
        </StackVertical>
      </ExampleSection>
      <ExampleSection title="UnorderedList in a Grid">
        <Grid columns={2} gap="sm">
          <UnorderedList aria-label="Games">
            <For each={GAMES}>
              {(game) => (
                <ListEntry>
                  <ExampleTile label={game} />
                </ListEntry>
              )}
            </For>
          </UnorderedList>
        </Grid>
      </ExampleSection>
      <ExampleSection title="OrderedList: order is announced, not drawn">
        <StackHorizontal gap="sm">
          <OrderedList aria-label="Phases">
            <For each={STEPS}>
              {(step) => (
                <ListEntry>
                  <ExampleTile label={step} />
                </ListEntry>
              )}
            </For>
          </OrderedList>
        </StackHorizontal>
      </ExampleSection>
    </ExampleRoot>
  );
}
