import { expect, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import type { WordTileBoardCell } from '../word-tile-board/index';
import { WordTileBlankContext } from './word-tile-blank-context';

function cells(blank: number): readonly WordTileBoardCell[] {
  return Array.from({ length: 225 }, (_, index) => {
    const id = `${String.fromCharCode(97 + (index % 15))}${Math.floor(index / 15) + 1}`;
    const letter = index === blank ? 'A' : index === 111 ? 'C' : '';
    return {
      id,
      letter,
      points: index === blank ? 0 : letter === 'C' ? 3 : null,
      square: index === 112 ? 'start' : null,
      state: index === blank ? 'tentative' : letter ? 'committed' : 'empty',
      label:
        index === blank
          ? `A 0, ${id}, tentative blank`
          : `${id}, ${letter || 'empty'}`,
      enabled: false,
    };
  });
}

const meta = {
  id: 'games-word-tiles-blank-context',
  title: 'Games/Word Tiles/Blank context',
  component: WordTileBlankContext,
  tags: ['autodocs'],
  args: {
    cells: cells(112),
    index: 112,
    summary: 'Scores: Amber 42, Teal 24',
    testId: 'blank-story',
  },
  argTypes: { cells: { control: false } },
} satisfies Meta<typeof WordTileBlankContext>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The assignment context keeps the blank, nearby committed tile and scores visible. */
export const Centre: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText('Blank at h8. Scores: Amber 42, Teal 24')
    ).toBeVisible();
    await expect(canvas.getByText('Nearby squares: e7 to k9')).toBeVisible();
    await expect(
      canvas.getByLabelText('A 0, h8, tentative blank')
    ).toBeVisible();
    await expect(canvas.getByLabelText('g8, C')).toBeVisible();
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
  },
};

/** At the top-left edge the neighborhood remains a complete three-by-seven grid. */
export const TopLeft: Story = {
  args: { cells: cells(0), index: 0 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Nearby squares: a1 to g3')).toBeVisible();
    await expect(
      canvas.getByLabelText('A 0, a1, tentative blank')
    ).toBeVisible();
  },
};

/** Four scores and a long next-action explanation wrap beside a bottom-right blank. */
export const BottomRightLongSummary: Story = {
  args: {
    cells: cells(224),
    index: 224,
    summary:
      'Scores: Amber 142, Teal 124, Violet 118, Coral 106. Choose a letter to continue building your word; the blank always scores zero points.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Nearby squares: i13 to o15')).toBeVisible();
    await expect(
      canvas.getByLabelText('A 0, o15, tentative blank')
    ).toBeVisible();
  },
};
