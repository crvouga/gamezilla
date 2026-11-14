import { expect, fn, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Button } from '../button/index';
import { GameRulesScreen } from './index';

const meta = {
  id: 'templates-game-rules',
  title: 'Templates/Game rules',
  component: GameRulesScreen,
  tags: ['autodocs'],
  parameters: { appRouter: true, controls: { exclude: ['sections'] } },
  args: {
    screenId: 'game-how-to-play',
    eyebrow: 'How to play',
    title: 'Connect Four',
    motif: 'discs',
    subtitle: 'Drop a disc. Connect four. Plan your next turn.',
    sections: [
      {
        key: 'goal',
        title: 'Goal',
        body: 'Line up four of your own: in a row, a column or a diagonal.',
      },
      {
        key: 'turn',
        title: 'Your turn',
        body: 'Red circles play first, then Yellow diamonds. Choose a column; your piece drops into its lowest empty place.',
      },
      {
        key: 'end',
        title: 'The end',
        body: 'Four in a line wins. A full board without four is a draw.',
      },
    ],
  },
  render: (args) => (
    <GameRulesScreen
      {...args}
      actions={
        <>
          <Button title="Play with friends or bots" onClick={fn()} />
          <Button
            title="Back to Connect Four"
            intent="neutral"
            variant="outline"
            onClick={fn()}
          />
        </>
      }
    />
  ),
} satisfies Meta<typeof GameRulesScreen>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The rules in numbered parts, then what leads on from them. */
export const Default: Story = {};

/** Every part is a heading the screen reader can jump between. */
export const Headings: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole('heading', { name: 'Your turn' })
    ).toBeVisible();
  },
};
