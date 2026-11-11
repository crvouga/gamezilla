import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { MultiplayerScreenView } from './multiplayer-screen-view';
import {
  renderStory,
  SPEED_RATINGS,
  STORY_FINISHED_GAME,
  STORY_PARAMETERS,
  storyArgs,
} from './multiplayer-screen-view.example';

const meta = {
  id: 'screens-games-matchmaking-ratings',
  title: 'Screens/Games/Matchmaking/Your ratings',
  component: MultiplayerScreenView,
  tags: ['autodocs'],
  parameters: STORY_PARAMETERS,
  render: renderStory(),
  args: {
    ...storyArgs(),
    stage: 'idle',
    place: { screen: 'ratings', from: 'find' },
  },
} satisfies Meta<typeof MultiplayerScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A game with one rating, still provisional: the quiet "?" and what it means. */
export const GameRating: Story = {};

/** A game with clock choices: one rating per speed. */
export const PerSpeed: Story = {
  args: { title: 'Chess', ratings: SPEED_RATINGS },
};

/** A settled rating has no "?" and counts its rated games. */
export const Settled: Story = {
  args: { ratings: [{ pool: 'game', rating: 1688, games: 240 }] },
};

/** After a game: the ratings are one row from its result. */
export const AfterTheGame: Story = {
  args: {
    title: 'Chess',
    stage: 'finished',
    place: { screen: 'ratings', from: 'result' },
    game: STORY_FINISHED_GAME,
    ratings: SPEED_RATINGS,
  },
};

/** Offline: the ratings this device holds are still shown. */
export const Offline: Story = { args: { online: false } };
