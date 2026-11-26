import { createSignal, Show } from 'solid-js';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  GameHomeScreenView,
  type GameHomeScreenViewProps,
} from './game-home-screen-view';
import { storyGame } from './game-menu-catalog.example';
import type { GameMenuPlace } from './game-menu-places';

type CatalogArgs = GameHomeScreenViewProps & { gameId: string };

const meta = {
  id: 'screens-game-home-how-to-play',
  title: 'Screens/Space/Game home/How to play',
  component: GameHomeScreenView,
  tags: ['autodocs'],
  parameters: { appRouter: true, catalogLesson: true },
  argTypes: {
    gameId: {
      control: 'select',
      options: [
        'chess',
        'connect-four',
        'battleship',
        'numberlink',
        'sokoban',
        'quoridor',
        'quoridor-hill',
        'word-tiles',
        'word-tiles-3',
        'word-tiles-4',
        'hearts',
        'pong',
        'light-cycles',
        'light-cycles-3',
        'light-cycles-4',
      ],
    },
  },
  args: { gameId: 'quoridor' },
  render: (args, context) => {
    const [place, setPlace] = createSignal<GameMenuPlace>({
      screen: 'how-to-play',
    });
    return (
      <Show when={storyGame(context.loaded, args.gameId)} keyed>
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
  },
} satisfies Meta<CatalogArgs>;
export default meta;
type Story = StoryObj<{ gameId?: string }>;

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
