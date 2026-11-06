import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { SquareStackIcon } from '../icons';
import { TileBoard } from '../tile-board/index';
import { PreviewThumbnail } from './index';

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

function Board(): JSX.Element {
  return (
    <TileBoard
      label="A small board"
      testId="example-thumbnail-board"
      columns={4}
      rows={4}
      tiles={TILES}
      pieces={[
        { id: 'walker', column: 1, row: 2, glyph: '☻', tone: 'actor' },
        { id: 'block', column: 1, row: 1, glyph: '▢', tone: 'object' },
      ]}
      disabled
    />
  );
}

/** A board preview at both sizes, a stacked collection, and an icon. */
export default function PreviewThumbnailExample(): JSX.Element {
  return (
    <ExampleRoot>
      <div class="box flex-row flex-wrap items-center gap-4">
        <PreviewThumbnail size="md">
          <Board />
        </PreviewThumbnail>
        <PreviewThumbnail>
          <Board />
        </PreviewThumbnail>
        <PreviewThumbnail stacked>
          <Board />
        </PreviewThumbnail>
        <PreviewThumbnail stacked>
          <SquareStackIcon size={96} color="icon" />
        </PreviewThumbnail>
      </div>
    </ExampleRoot>
  );
}
