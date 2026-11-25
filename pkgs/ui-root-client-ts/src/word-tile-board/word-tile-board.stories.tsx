import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { WordTileBoard } from './index';
import Example from './word-tile-board.example';

const meta = {
  id: 'product-wordtileboard',
  title: 'Organisms/Games/Word Tiles/Board',
  component: WordTileBoard,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  // Related board components keep a desktop reference beside the phone one.
  tags: ['viewport-responsive'],
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};

/** Choose Fit or Enlarge: beside the board, or in a phone's Board tools dialog. */
async function chooseView(canvasElement: HTMLElement, name: string) {
  const canvas = within(canvasElement);
  const view = canvas.queryByRole('button', {
    name: 'Board tools: zoom and find a square',
  });
  if (view) await userEvent.click(view);
  const tools = view
    ? within(
        await within(canvasElement.ownerDocument.body).findByRole('dialog', {
          name: 'Board tools',
        })
      )
    : canvas;
  await userEvent.click(tools.getByRole('button', { name }));
}

/** Enlarge the same board, place a tile, then retain it in the overview. */
export const EnlargedPlacement: StoryObj = {
  // Related board components keep a desktop reference beside the phone one.
  tags: ['viewport-responsive'],
  render: () => <Example />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'S, 1 point' }));
    await chooseView(canvasElement, 'Enlarge board');
    await userEvent.click(canvas.getByRole('button', { name: 'e3, empty' }));
    await expect(
      canvas.getByRole('button', { name: 'S 1, e3, tentative' })
    ).toHaveAttribute('data-state', 'tentative');
    await chooseView(canvasElement, 'Fit board');
    await expect(
      canvas.getByRole('button', { name: 'S 1, e3, tentative' })
    ).toHaveFocus();
  },
};
