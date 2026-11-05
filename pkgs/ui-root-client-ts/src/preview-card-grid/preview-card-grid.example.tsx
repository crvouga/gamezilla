import { For, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { Badge } from '../badge/index';
import { PreviewThumbnail } from '../preview-thumbnail/index';
import { TileBoard } from '../tile-board/index';
import { PreviewCard, PreviewCardGrid } from './index';

const TILES = [
  ...['solid', 'solid', 'solid', 'solid'],
  ...['solid', 'open', 'open', 'solid'],
  ...['solid', 'open', 'open', 'solid'],
  ...['solid', 'solid', 'solid', 'solid'],
].map((terrain, index) => ({
  terrain: terrain as 'solid' | 'open',
  marked: index === 6,
  label: `Tile ${index + 1}`,
}));

function Board(props: { id: string }): JSX.Element {
  return (
    <TileBoard
      label="A small board"
      testId={`example-card-board-${props.id}`}
      columns={4}
      rows={4}
      tiles={TILES}
      pieces={[{ id: 'walker', column: 1, row: 2, glyph: '☻', tone: 'actor' }]}
      disabled
    />
  );
}

const CARDS = [
  { id: 'a', title: 'Two crates', difficulty: 'Easy', meta: undefined },
  {
    id: 'b',
    title: 'Around the pillar and back to the door without a step wasted',
    difficulty: 'Hard',
    meta: 'Weekend pack · Solved 2 of 5',
  },
  { id: 'c', title: 'Corridor', difficulty: 'Medium', meta: undefined },
] as const;

/** Puzzles told apart by their boards: a grid when wide, rows when narrow. */
export default function PreviewCardGridExample(): JSX.Element {
  return (
    <ExampleRoot>
      <PreviewCardGrid
        title="Continue playing"
        footer="Each attempt keeps your progress."
      >
        <For each={CARDS}>
          {(card) => (
            <PreviewCard
              picture={
                <PreviewThumbnail size="fill" stacked={card.id === 'b'}>
                  <Board id={card.id} />
                </PreviewThumbnail>
              }
              title={card.title}
              caption={<Badge intent="neutral" label={card.difficulty} />}
              meta={card.meta}
              onClick={() => undefined}
              dataSet={{ testid: `example-card-${card.id}` }}
            />
          )}
        </For>
      </PreviewCardGrid>
    </ExampleRoot>
  );
}
