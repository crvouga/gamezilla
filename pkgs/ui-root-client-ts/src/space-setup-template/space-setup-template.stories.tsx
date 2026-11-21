import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SPACE_EXAMPLE_GAME_KEYS } from '../../storybook/fixtures/space-example-games';
import { SpaceSetupTemplate } from './index';
import Example, {
  type SpaceSetupTemplateExampleProps,
} from './space-setup-template.example';

const meta = {
  id: 'space-setting-up-template',
  title: 'Space/SettingUp/Template',
  component: SpaceSetupTemplate,
  tags: ['autodocs'],
  args: {
    game: 'lightCycles',
    role: 'guest',
    ready: false,
    onBack: fn(),
    onSettings: fn(),
    onLeave: fn(),
    onEnd: fn(),
    onPersonAction: fn(),
    onInvite: fn(),
    onReadyChange: fn(),
    onStart: fn(),
    onChangeGame: fn(),
    onGameAction: fn(),
  },
  argTypes: {
    game: { control: 'select', options: SPACE_EXAMPLE_GAME_KEYS },
    role: { control: 'inline-radio', options: ['host', 'guest'] },
    ready: { control: 'boolean' },
  },
  parameters: {
    layout: 'fullscreen',
    controls: { include: ['game', 'role', 'ready'] },
  },
  render: (args) => <Example {...args} />,
} satisfies Meta<SpaceSetupTemplateExampleProps>;
export default meta;

type Story = StoryObj<SpaceSetupTemplateExampleProps>;

const HOST = { role: 'host', ready: true } as const;

/**
 * A guest while bob sets up Light Cycles: read-only settings, each rider's
 * color and seat on the data line, and I'm ready as the one action.
 */
export const LightCyclesGuest: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { name: 'bob is setting up Light Cycles' })
    ).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: "I'm ready" }));
    await expect(args.onReadyChange).toHaveBeenCalledWith(true);
  },
};

/** The host sets up Light Cycles with the game's own setup controls. */
export const LightCyclesHost: Story = {
  args: HOST,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Start Light Cycles' })
    );
    await expect(args.onStart).toHaveBeenCalledTimes(1);
  },
};

/** Chess for a guest: a side and a clock on each data line. */
export const ChessGuest: Story = { args: { game: 'chess' } };

/** Chess for the host: mode and clock controls. */
export const ChessHost: Story = { args: { game: 'chess', ...HOST } };

/** Hearts for a guest: two bots fill the empty seats, ready from the start. */
export const HeartsGuest: Story = { args: { game: 'hearts' } };

/** Hearts for the host, with the bots that fill its seats. */
export const HeartsHost: Story = { args: { game: 'hearts', ...HOST } };

/** Battleship for a guest: nothing on the data line, which stays reserved. */
export const BattleshipGuest: Story = { args: { game: 'battleship' } };

/** Battleship for the host. */
export const BattleshipHost: Story = { args: { game: 'battleship', ...HOST } };

/** Word Tiles for a guest who has said they are ready. */
export const WordTilesGuest: Story = {
  args: { game: 'wordTiles', ready: true },
};

/** Word Tiles for the host while ana is not ready: Start waits. */
export const WordTilesHost: Story = {
  args: { game: 'wordTiles', role: 'host', ready: false },
};
