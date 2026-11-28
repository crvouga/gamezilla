import { expect, waitFor, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './icon-button.example';
import { IconButton } from './index';

const meta = {
  id: 'components-inputs-iconbutton',
  title: 'Atoms/IconButton',
  component: IconButton,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const name of ['Back', 'Close', 'Settings']) {
      for (const button of canvas.getAllByRole('button', {
        name,
      })) {
        const glyph = button.querySelector('use');
        await waitFor(() => expect(glyph?.getBBox().width).toBeGreaterThan(0));
      }
    }
  },
};
