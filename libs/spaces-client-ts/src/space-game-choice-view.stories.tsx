import { Handles } from '@libs/test-ids-shared-ts/handles';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SpaceGameChoiceView } from './space-game-choice-view';
import {
  AVERY,
  JORDAN,
  MORGAN,
  ROBIN,
  SAM,
  STORY_GAME_FAMILIES,
  storyChrome,
} from './spaces-story.example';

const meta = {
  id: 'screens-spaces-games',
  title: 'Screens/Spaces/Games',
  component: SpaceGameChoiceView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['chrome', 'families', 'notice'] },
  },
  args: {
    chrome: storyChrome('host'),
    families: STORY_GAME_FAMILIES,
    canChoose: true,
    onChoose: fn(),
  },
} satisfies Meta<typeof SpaceGameChoiceView>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The host chooses what the space plays: row 1 (the space), row 2 (who is
 * here, Invite at its end), then one tile per game with its fit for the
 * five here; Light Cycles is one tile for its three modes.
 */
export const HostChoosing: Story = {};

/** Alone in the space: games for two or more say what they need. */
export const HostAlone: Story = {
  args: { chrome: storyChrome('host', [AVERY]) },
};

/** A guest sees the same games, not pressable, and that avery is choosing. */
export const GuestWaiting: Story = {
  args: { chrome: storyChrome('guest'), canChoose: false },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByTestId(Handles.spaceHostChoosesGame)
    ).toHaveTextContent('avery is choosing a game');
    await userEvent.click(
      await canvas.findByTestId(Handles.gameMenu('example-board'))
    );
    await expect(args.onChoose).not.toHaveBeenCalled();
  },
};

/** Three here: a four-player game offers bots to the host. */
export const SmallRoom: Story = {
  args: { chrome: storyChrome('host', [AVERY, JORDAN, MORGAN]) },
};

/** A crowd past every game's seats: each tile still says who plays. */
export const FullRoom: Story = {
  args: {
    chrome: storyChrome('host', [AVERY, JORDAN, MORGAN, ROBIN, SAM]),
  },
};

/** The host picks a lone game: it is chosen for the whole space. */
export const SelectGame: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId(Handles.gameMenu('example-cards'))
    );
    await expect(args.onChoose).toHaveBeenCalledWith('example-cards');
  },
};

/** A family's tile opens its modes; picking one chooses it for the space. */
export const ChooseMode: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId(Handles.gameFamily('example-race'))
    );
    const sheet = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await sheet.findByTestId(Handles.gameMenu('example-race-3'))
    );
    await expect(args.onChoose).toHaveBeenCalledWith('example-race-3');
  },
};
