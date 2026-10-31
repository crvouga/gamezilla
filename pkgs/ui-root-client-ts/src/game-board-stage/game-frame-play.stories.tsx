import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './game-frame-play.example';
import { GameBoardStage } from './index';

const meta = {
  id: 'product-game-frame-play',
  title: 'Games/Shared/Components/GamePlay',
  component: GameBoardStage,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
  play: async ({ canvasElement, step }) => {
    const panes = canvasElement.querySelectorAll<HTMLElement>(
      '[data-component="SchemePane"]'
    );
    await expect(panes).toHaveLength(2);
    for (const pane of panes) {
      await step(
        `Choose a wall tool and return to Move in ${pane.dataset['scheme']}`,
        async () => {
          const canvas = within(pane);
          const wall = canvas.getByTestId('example-mode-h');
          wall.focus();
          await userEvent.keyboard('{Enter}');
          await expect(wall).toHaveFocus();
          await expect(wall).toHaveAttribute('aria-pressed', 'true');
          await userEvent.click(canvas.getByTestId('example-mode-move'));
          await expect(wall).toHaveAttribute('aria-pressed', 'false');
        }
      );
    }
    (canvasElement.ownerDocument.activeElement as HTMLElement | null)?.blur();
  },
};

import { expect, userEvent, within } from 'storybook/test';
