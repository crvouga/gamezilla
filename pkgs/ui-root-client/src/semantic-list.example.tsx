/** @jsxImportSource solid-js */
import { For, type JSX } from 'solid-js';
import { ExampleRoot } from './example-root';
import { ExampleSection, ExampleTile } from './example-section';
import { Grid } from './grid';
import { ListEntry, OrderedList, UnorderedList } from './semantic-list';
import { StackHorizontal, StackVertical } from './stack';

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
