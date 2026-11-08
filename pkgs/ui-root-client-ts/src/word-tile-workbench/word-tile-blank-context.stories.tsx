import { expect, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import type { WordTileBoardCell } from '../word-tile-board/index';
import { WordTileBlankContext } from './word-tile-blank-context';

const cells: readonly WordTileBoardCell[] = Array.from(
  { length: 225 },
  (_, index) => {
    const id = `${String.fromCharCode(97 + (index % 15))}${Math.floor(index / 15) + 1}`;
    const letter = index === 111 ? 'C' : index === 113 ? 'T' : '';
    return {
      id,
      letter,
      points: letter === '' ? null : 1,
      square: index === 112 ? 'start' : null,
      state: letter === '' ? 'empty' : 'committed',
      label: `${id}${letter === '' ? ', empty' : `, ${letter}`}`,
      enabled: false,
    };
  }
);

const meta = {
  id: 'product-wordtileblankcontext',
  title: 'Games/Word Tiles/Blank context',
  component: WordTileBlankContext,
  tags: ['autodocs', 'viewport-responsive'],
  args: {
    cells,
    index: 112,
    summary: 'Between C and T.',
    testId: 'blank-example',
  },
} satisfies Meta<typeof WordTileBlankContext>;
export default meta;

/** The blank's location and neighboring committed letters remain visible during assignment. */
export const InAWord: StoryObj<typeof meta> = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText('Blank at h8. Between C and T.')
    ).toBeVisible();
    const neighbors = canvas.getByRole('group', {
      name: 'Nearby squares; outlined square is your blank',
    });
    await expect(within(neighbors).getByText('C')).toBeVisible();
    await expect(within(neighbors).getByText('T')).toBeVisible();
  },
};
