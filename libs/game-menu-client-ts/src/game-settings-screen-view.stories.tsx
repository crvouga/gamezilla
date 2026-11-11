import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  type GameSettingsRowView,
  GameSettingsScreenView,
} from './game-settings-screen-view';

const DEVELOPER: GameSettingsRowView = {
  key: 'developer',
  title: 'Developer',
  caption: 'Puzzle import tools.',
  testId: 'chess-settings-developer',
  opens: { screen: 'settings/developer' },
};

const PUZZLES: GameSettingsRowView = {
  key: 'puzzles',
  title: 'Load chess puzzles',
  caption: 'Load Lichess CSV, follow progress, and stop loading.',
  testId: 'chess-developer-puzzles',
  opens: { screen: 'settings/developer/puzzles' },
};

const meta = {
  id: 'screens-games-settings-group',
  title: 'Screens/Games/Settings/Group',
  component: GameSettingsScreenView,
  tags: ['autodocs'],
  parameters: { appRouter: true, controls: { exclude: ['rows', 'place'] } },
  args: {
    place: { screen: 'settings' },
    title: 'Settings',
    subtitle: 'Developer tools.',
    rows: [DEVELOPER],
    onOpen: fn(),
  },
} satisfies Meta<typeof GameSettingsScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The settings' first screen: the rows of the root group the game declared. */
export const Root: Story = {};

/** A nested group, opened by its row: named by that row, with its own rows. */
export const NestedGroup: Story = {
  args: {
    place: { screen: 'settings/developer' },
    title: 'Developer',
    subtitle: 'Import and manage puzzle content.',
    rows: [PUZZLES],
  },
};

/**
 * A row gated by a permission the person lacks is left out; the rows they
 * may open remain.
 */
export const PermissionHiddenRows: Story = {
  args: {
    place: { screen: 'settings/developer' },
    title: 'Developer',
    subtitle: 'Import and manage puzzle content.',
    rows: [
      {
        key: 'board',
        title: 'Board and pieces',
        caption: 'How the board is drawn on this device.',
        testId: 'chess-developer-board',
        opens: { screen: 'settings/developer/board' },
      },
    ],
  },
};

/** A group none of whose rows the person may see says so, with the way out. */
export const EmptyGroup: Story = {
  args: {
    place: { screen: 'settings/developer' },
    title: 'Developer',
    subtitle: 'Import and manage puzzle content.',
    rows: [],
  },
};

/** Long names and captions wrap inside their rows. */
export const LongContent: Story = {
  args: {
    title: 'Settings for the extended tournament edition',
    subtitle:
      'Everything that changes how this game looks, sounds and loads its content on this device.',
    rows: [
      {
        ...DEVELOPER,
        title: 'Developer tools for importing and checking puzzle content',
        caption:
          'Load a shared source file, follow how far the load is, stop it, and see what the last load added, updated and found broken.',
      },
      PUZZLES,
    ],
  },
};

/** Pressing a row opens the place it names. */
export const OpenRow: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('chess-settings-developer')
    );
    await expect(args.onOpen).toHaveBeenCalledWith({
      screen: 'settings/developer',
    });
  },
};
