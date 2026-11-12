import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { MultiplayerScreenView } from './multiplayer-screen-view';
import {
  renderStory,
  STORY_PARAMETERS,
  storyArgs,
} from './multiplayer-screen-view.example';

const meta = {
  id: 'screens-games-matchmaking-guide',
  title: 'Screens/Games/Matchmaking/How it works',
  component: MultiplayerScreenView,
  tags: ['autodocs'],
  parameters: STORY_PARAMETERS,
  render: (args) => renderStory()(args),
  args: {
    ...storyArgs(),
    stage: 'idle',
    place: { screen: 'guide' },
  },
} satisfies Meta<typeof MultiplayerScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** What a search does, in three short points. */
export const Guide: Story = {};

/** Offline: the notice sits above the guide. */
export const Offline: Story = { args: { online: false } };
