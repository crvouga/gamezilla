import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './card-table.example';
import { CardTable } from './index';

const meta = {
  id: 'product-cardtable',
  title: 'Games/Hearts/Table',
  component: CardTable,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  // Related board components keep a desktop reference beside the phone one.
  tags: ['viewport-responsive'],
  parameters: { controls: { disable: true } },
  render: () => <Example />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // regression: card-table-pass-prompt-covers-direction — the passing
    // table drew its prompt in the same place as where the cards go, so
    // 'Choose three cards to pass' covered 'Passing to the left'.
    const prompt = canvas
      .getByTestId('example-card-table-center')
      .getBoundingClientRect();
    const direction = canvas.getByText('Passing to the left');
    for (const shown of [direction, direction.nextElementSibling]) {
      if (!shown) throw new Error('The pass has no places');
      const box = shown.getBoundingClientRect();
      await expect(
        box.bottom <= prompt.top ||
          box.top >= prompt.bottom ||
          box.right <= prompt.left ||
          box.left >= prompt.right
      ).toBe(true);
    }
    const refused = canvas.getByTestId('example-play-card-9D');
    await expect(refused).toHaveAttribute(
      'title',
      'You must follow suit with a spade.'
    );
    await expect(refused).toHaveTextContent('×');
    await userEvent.click(refused);
    await expect(
      canvas.getByTestId('example-play-table-refusal')
    ).toHaveTextContent('You must follow suit with a spade.');
    await userEvent.click(canvas.getByTestId('example-play-card-QS'));
    await expect(canvas.queryByTestId('example-play-card-QS')).toBeNull();
  },
};
