import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SpaceGamesScreenView } from './space-games-screen-view';
import { GameAreaExample } from './space-story-game-area.example';
import { GAMES } from './spaces-story.example';

const meta = {
  id: 'screens-spaces-games',
  title: 'Screens/Spaces/Games',
  component: SpaceGamesScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['games', 'renderGameMenu'] },
  },
  args: {
    games: GAMES,
    shownGame: null,
    canSelectGame: true,
    hostChoosesNotice: false,
    onSelectGame: fn(),
    renderGameMenu: () => <GameAreaExample title={"The chosen game's menu"} />,
  },
} satisfies Meta<typeof SpaceGamesScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The host picks what the space plays from the registered games. */
export const HostChoosing: Story = {};

/** A guest sees the same list, told the host picks; rows are not pressable. */
export const GuestWaiting: Story = { args: { canSelectGame: false } };

/** A game is chosen: its own menu replaces the list (a slot; games live elsewhere). */
export const GameChosen: Story = { args: { shownGame: 'example-board' } };

/** A guest pressed Back inside the game: told only the host moves the space. */
export const GuestTriedBack: Story = {
  args: {
    canSelectGame: false,
    shownGame: 'example-board',
    hostChoosesNotice: true,
  },
};

/** Long titles and captions wrap inside the menu rows. */
export const LongContent: Story = {
  args: {
    games: [
      ...GAMES,
      {
        id: 'long',
        title: 'A game with a remarkably long localized title',
        caption:
          'A caption that keeps going to show how a long description wraps in the games list.',
      },
    ],
  },
};

/** Pressing a game as host selects it for the whole space. */
export const SelectGame: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('game-menu-example-cards'));
    await expect(args.onSelectGame).toHaveBeenCalledWith('example-cards');
  },
};
