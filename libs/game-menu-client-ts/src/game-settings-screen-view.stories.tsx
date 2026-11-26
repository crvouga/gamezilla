import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  type GameSettingsRowView,
  GameSettingsScreenView,
} from './game-settings-screen-view';

const APPEARANCE: GameSettingsRowView = {
  key: 'appearance',
  title: 'Appearance',
  caption: 'Board and piece appearance.',
  testId: 'chess-settings-appearance',
  opens: { screen: 'settings/appearance' },
};

const COLOURS: GameSettingsRowView = {
  key: 'colors',
  title: 'Square colors',
  caption: 'Choose the colors of light and dark squares.',
  testId: 'chess-appearance-colors',
  opens: { screen: 'settings/appearance/colors' },
};

const meta = {
  id: 'screens-game-home-settings',
  title: 'Screens/Space/Game home/Settings',
  component: GameSettingsScreenView,
  tags: ['autodocs'],
  parameters: { appRouter: true, controls: { exclude: ['rows', 'place'] } },
  args: {
    place: { screen: 'settings' },
    title: 'Settings',
    subtitle: 'How this game looks on your device.',
    rows: [APPEARANCE],
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
    place: { screen: 'settings/appearance' },
    title: 'Appearance',
    subtitle: 'Board and piece appearance.',
    rows: [COLOURS],
  },
};

/**
 * A row gated by a permission the person lacks is left out; the rows they
 * may open remain.
 */
export const PermissionHiddenRows: Story = {
  args: {
    place: { screen: 'settings/appearance' },
    title: 'Appearance',
    subtitle: 'Board and piece appearance.',
    rows: [
      {
        key: 'board',
        title: 'Board and pieces',
        caption: 'How the board is drawn on this device.',
        testId: 'chess-appearance-board',
        opens: { screen: 'settings/appearance/board' },
      },
    ],
  },
};

/** A group none of whose rows the person may see says so, with the way out. */
export const EmptyGroup: Story = {
  args: {
    place: { screen: 'settings/appearance' },
    title: 'Appearance',
    subtitle: 'Board and piece appearance.',
    rows: [],
  },
};

/** Long names and captions wrap inside their rows. */
export const LongContent: Story = {
  args: {
    title: 'Settings for the extended tournament edition',
    subtitle:
      'Everything that changes how this game looks and sounds on this device.',
    rows: [
      {
        ...APPEARANCE,
        title: 'Board appearance during tournament play',
        caption:
          'Choose how the board, pieces, coordinates and last move appear when you play in a tournament.',
      },
      COLOURS,
    ],
  },
};

/** Pressing a row opens the place it names. */
export const OpenRow: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('chess-settings-appearance')
    );
    await expect(args.onOpen).toHaveBeenCalledWith({
      screen: 'settings/appearance',
    });
  },
};
