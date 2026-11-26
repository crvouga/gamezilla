import { withChessBoardContext } from '@libs/chess-root-client-ts/chess-board-story.example';
import { GameHomeScreenView } from '@libs/game-menu-client-ts/game-home-screen-view';
import type { GameMenuPlace } from '@libs/game-menu-client-ts/game-menu-places';
import { createSignal, Show } from 'solid-js';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { GAME_CLIENT_DEFINITIONS } from './game-plugins.client';

function Walkthrough(props: { gameId: string }) {
  const [place, setPlace] = createSignal<GameMenuPlace>({
    screen: 'how-to-play',
  });
  return (
    <Show
      when={GAME_CLIENT_DEFINITIONS.find((game) => game.id === props.gameId)}
      keyed
    >
      {(game) => (
        <GameHomeScreenView
          title={game.title}
          tile={game.motif}
          subtitle={game.caption}
          lesson={game.lesson}
          choices={[]}
          place={place()}
          onOpen={setPlace}
          onChoose={() => undefined}
        />
      )}
    </Show>
  );
}
const meta = {
  id: 'screens-game-home-how-to-play',
  title: 'Screens/Space/Game home/How to play',
  component: Walkthrough,
  decorators: [withChessBoardContext],
  parameters: { appRouter: true },
  argTypes: {
    gameId: {
      control: 'select',
      options: GAME_CLIENT_DEFINITIONS.map((game) => game.id),
    },
  },
  args: { gameId: 'quoridor' },
} satisfies Meta<typeof Walkthrough>;
export default meta;
type Story = StoryObj<typeof meta>;

export const FirstMove: Story = {};
export const PlaceAWall: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('practice-board-action-e2')
    );
    await userEvent.click(await canvas.findByTestId('practice-next'));
    const d6 = canvas.getByTestId('practice-board-action-d6');
    const tapGap = () => {
      const lower = d6.getBoundingClientRect();
      const upper = canvas
        .getByTestId('practice-board-action-d7')
        .getBoundingClientRect();
      return userEvent.pointer({
        target: canvas.getByTestId('practice-board'),
        coords: {
          clientX: lower.left + lower.width * 0.75,
          clientY: (upper.bottom + lower.top) / 2,
        },
        keys: '[MouseLeft]',
      });
    };
    await tapGap();
    await expect(d6).toHaveAttribute('data-preview-edge-top', 'true');
    await tapGap();
    await expect(d6).toHaveAttribute('data-edge-top', 'true');
    await expect(
      canvas.getByTestId('practice-board-action-e6')
    ).toHaveAttribute('data-edge-top', 'true');
    await expect(canvas.getByTestId('practice-next')).toBeEnabled();
  },
};
