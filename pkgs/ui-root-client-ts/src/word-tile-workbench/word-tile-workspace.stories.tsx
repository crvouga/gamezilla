import { expect, fn, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Button } from '../button/index';
import { P } from '../text/index';
import { TileRack, type TileRackTile } from '../tile-rack/index';
import {
  WordTileBoard,
  type WordTileBoardCell,
  type WordTileSquare,
} from '../word-tile-board/index';
import { WordTileWorkbench } from './index';
import { WordTileWorkspace } from './word-tile-workspace';

const COLUMNS = 'abcdefghijklmno'.split('');
const ROWS = Array.from({ length: 15 }, (_, n) => String(n + 1));
const SQUARE_TEXT: Readonly<Record<WordTileSquare, string>> = {
  DL: '2L',
  TL: '3L',
  DW: '2W',
  TW: '3W',
  start: '★',
};
/** CAT across the centre, its T the latest tile played. */
const WORD: Readonly<Record<number, string>> = { 111: 'C', 112: 'A', 113: 'T' };

function cells(): readonly WordTileBoardCell[] {
  return Array.from({ length: 225 }, (_, index) => {
    const id = `${COLUMNS[index % 15]}${ROWS[Math.floor(index / 15)]}`;
    const letter = WORD[index] ?? '';
    return {
      id,
      letter,
      points: letter === '' ? null : 1,
      square: index === 112 ? 'start' : null,
      state: letter === '' ? 'empty' : index === 113 ? 'recent' : 'committed',
      label: `${id}, ${letter || 'empty'}`,
      enabled: letter === '',
    };
  });
}

const RACK: readonly TileRackTile[] = ['S', 'E', 'A', 'R', 'O', 'N', 'T'].map(
  (letter, n) => ({
    id: String(n),
    letter,
    points: 1,
    selected: false,
    placed: false,
    label: `${letter}, 1 point`,
    enabled: true,
  })
);

const meta = {
  id: 'games-word-tiles-workspace',
  title: 'Organisms/Games/Word Tiles/Workspace',
  component: WordTileWorkspace,
  tags: ['autodocs', 'viewport-responsive'],
  render: (args) => (
    <WordTileWorkspace
      finished={args.finished === true}
      notice={
        <P tone="secondary">
          The word list could not load here; the game checks words when you
          play.
        </P>
      }
      rack={
        <TileRack
          label="Your rack"
          testId="workspace-rack"
          tiles={RACK}
          onActivate={fn()}
        />
      }
      actions={
        <WordTileWorkbench>
          <Button title="Play word" />
        </WordTileWorkbench>
      }
      feedback={<P role="status">Place tiles to make a word.</P>}
      board={
        <WordTileBoard
          label="Board"
          testId="workspace-board"
          columnLabels={COLUMNS}
          rowLabels={ROWS}
          cells={cells()}
          squareText={(square) => SQUARE_TEXT[square]}
          onActivate={fn()}
        />
      }
    />
  ),
  argTypes: {
    notice: { control: false },
    rack: { control: false },
    actions: { control: false },
    feedback: { control: false },
    board: { control: false },
  },
  args: {
    finished: false,
    rack: undefined,
    board: undefined,
  },
} satisfies Meta<typeof WordTileWorkspace>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The reading order, the same in either layout: the board first, then its
 * feedback, the rack and the actions under it.
 */
async function assertReadingOrder(canvasElement: HTMLElement): Promise<void> {
  const canvas = within(canvasElement);
  const layout = canvasElement.querySelector<HTMLElement>(
    '[data-component="WordTileWorkspace"]'
  );
  if (!layout) throw new Error('WordTileWorkspace is not rendered');
  await expect(['wide', 'stacked']).toContain(layout.dataset['layout']);
  const order = [
    canvas.getByTestId('workspace-board'),
    canvas.getByRole('status'),
    canvas.getByTestId('workspace-rack'),
    canvas.getByRole('button', { name: 'Play word' }),
  ];
  for (const [index, element] of order.slice(1).entries()) {
    const before = order[index];
    await expect(
      before !== undefined &&
        (before.compareDocumentPosition(element) &
          Node.DOCUMENT_POSITION_FOLLOWING) !==
          0
    ).toBe(true);
  }
}

/** A turn in play: the board leads, with the rack and its actions under it. */
export const InPlay: Story = {
  play: async ({ canvasElement }) => assertReadingOrder(canvasElement),
};

/** A finished game: the board is for review, so it takes less room while the order stays the same. */
export const Finished: Story = {
  args: { finished: true },
  play: async ({ canvasElement }) => {
    const layout = canvasElement.querySelector<HTMLElement>(
      '[data-component="WordTileWorkspace"]'
    );
    await expect(layout?.dataset['finished']).toBe('true');
    await assertReadingOrder(canvasElement);
  },
};
