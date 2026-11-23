import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { MatchmakingScreenView } from './matchmaking-screen-view';
import {
  renderStory,
  STORY_PARAMETERS,
  storyArgs,
} from './matchmaking-screen-view.example';

const meta = {
  id: 'screens-matchmaking-guide',
  title: 'Screens/Space/Matchmaking/How it works',
  component: MatchmakingScreenView,
  tags: ['autodocs'],
  parameters: STORY_PARAMETERS,
  render: (args) => renderStory()(args),
  args: {
    ...storyArgs(),
    stage: 'idle',
    place: { screen: 'guide' },
  },
} satisfies Meta<typeof MatchmakingScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** What a search does, in three short points. */
export const Guide: Story = {};

/** Offline: the notice sits above the guide. */
export const Offline: Story = { args: { online: false } };
