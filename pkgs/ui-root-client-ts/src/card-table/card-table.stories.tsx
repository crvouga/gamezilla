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
  parameters: { controls: { disable: true } },
  render: () => <Example />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
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
