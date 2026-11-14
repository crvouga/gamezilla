import {
  DefineBackButton,
  GameChoicesName,
} from '@libs/spaces-client-ts/spaces-nav-context';
import { createSignal, type JSX } from 'solid-js';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  type GameSettingsRowView,
  GameSettingsScreenView,
  type GameSettingsScreenViewProps,
} from './game-settings-screen-view';

const DEVELOPER: GameSettingsRowView = {
  key: 'developer',
  title: 'Developer',
  caption: 'Import and manage chess puzzles',
  testId: 'chess-settings-developer',
  opens: { screen: 'settings/developer' },
};

const PUZZLES: GameSettingsRowView = {
  key: 'puzzles',
  title: 'Load chess puzzles',
  caption: 'Load a Lichess CSV, follow its progress, or stop it.',
  testId: 'chess-developer-puzzles',
  opens: { screen: 'settings/developer/puzzles' },
};

/**
 * A settings group as `GameSettingsScreen` shows it in a space: the bar's
 * Back names where it leads (`backLabel`), the game's name in its trail.
 */
function SettingsStory(props: GameSettingsScreenViewProps): JSX.Element {
  return (
    <GameChoicesName name="Chess">
      <DefineBackButton
        onPress={props.onBack}
        label={
          typeof props.backLabel === 'string' ? props.backLabel : undefined
        }
        within={props.place.screen !== 'settings'}
      />
      <GameSettingsScreenView {...props} />
    </GameChoicesName>
  );
}

const meta = {
  id: 'screens-games-settings-group',
  title: 'Screens/Games/Settings/Group',
  component: GameSettingsScreenView,
  render: (args) => <SettingsStory {...args} />,
  tags: ['autodocs'],
  parameters: { appRouter: true, controls: { exclude: ['rows', 'place'] } },
  args: {
    place: { screen: 'settings' },
    title: 'Settings',
    rows: [DEVELOPER],
    onOpen: fn(),
    backLabel: 'Chess',
    onBack: fn(),
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
    subtitle: 'Import and manage chess puzzles.',
    rows: [PUZZLES],
    backLabel: 'Settings',
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
    subtitle: 'Import and manage chess puzzles.',
    rows: [
      {
        key: 'board',
        title: 'Board and pieces',
        caption: 'How the board is drawn on this device.',
        testId: 'chess-developer-board',
        opens: { screen: 'settings/developer/board' },
      },
    ],
    backLabel: 'Settings',
  },
};

/** A group none of whose rows the person may see says so, with the way back. */
export const EmptyGroup: Story = {
  args: {
    place: { screen: 'settings/developer' },
    title: 'Developer',
    subtitle: 'Import and manage chess puzzles.',
    rows: [],
    backLabel: 'Settings',
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Back to Settings' })
    );
    await expect(args.onBack).toHaveBeenCalled();
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

/**
 * Chess's settings walked as `GameSettingsScreen` walks them: a row opens
 * its group, Back (the bar's or the screen's) walks up one group, and from
 * the root returns to the game's menu.
 */
function SettingsWalk(props: {
  readonly onLeave: () => void;
  readonly onLoad: () => void;
}): JSX.Element {
  const [place, setPlace] = createSignal('settings');
  const root = (): boolean => place() === 'settings';
  const back = (): void => {
    if (root()) props.onLeave();
    else setPlace('settings');
  };
  return (
    <GameChoicesName name="Chess">
      <DefineBackButton
        onPress={back}
        label={root() ? 'Chess' : 'Settings'}
        within={!root()}
      />
      <GameSettingsScreenView
        place={{ screen: place() }}
        title={root() ? 'Settings' : 'Developer'}
        subtitle={root() ? undefined : 'Import and manage chess puzzles.'}
        rows={root() ? [DEVELOPER] : [PUZZLES]}
        onOpen={(opened) => {
          if (opened.screen === 'settings/developer') setPlace(opened.screen);
          else props.onLoad();
        }}
        backLabel={root() ? 'Chess' : 'Settings'}
        onBack={back}
      />
    </GameChoicesName>
  );
}

/**
 * Open a group, then walk back up with Back: on a phone the bar's Back
 * names the group it returns to ("Settings", then "Chess").
 */
export const WalkTheGroups: Story = {
  args: { onBack: fn() },
  render: (args) => <SettingsWalk onLeave={args.onBack} onLoad={fn()} />,
};
