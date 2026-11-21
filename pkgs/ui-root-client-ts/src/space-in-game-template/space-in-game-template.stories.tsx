import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SPACE_EXAMPLE_PLAY_KEYS } from '../../storybook/fixtures/space-example-games';
import { SpaceInGameTemplate } from './index';
import Example, {
  type SpaceInGameTemplateExampleProps,
} from './space-in-game-template.example';

const meta = {
  id: 'space-in-game-template',
  title: 'Space/InGame/Template',
  component: SpaceInGameTemplate,
  tags: ['autodocs'],
  args: {
    game: 'lightCycles',
    role: 'guest',
    onBack: fn(),
    onSettings: fn(),
    onLeave: fn(),
    onEnd: fn(),
    onPersonAction: fn(),
    onInvite: fn(),
    onGameAction: fn(),
  },
  argTypes: {
    game: { control: 'select', options: SPACE_EXAMPLE_PLAY_KEYS },
    role: { control: 'inline-radio', options: ['host', 'guest'] },
  },
  parameters: {
    layout: 'fullscreen',
    controls: { include: ['game', 'role'] },
  },
  render: (args) => <Example {...args} />,
} satisfies Meta<SpaceInGameTemplateExampleProps>;
export default meta;

type Story = StoryObj<SpaceInGameTemplateExampleProps>;

const HOST = { role: 'host' } as const;

/**
 * A guest riding in Light Cycles: player-color rings, round wins on the
 * data line, Turn left and Turn right in the action bar. Pressing a person
 * opens their sheet over the stage.
 */
export const LightCyclesGuest: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Turn left' }));
    await expect(args.onGameAction).toHaveBeenCalledWith('turn-left');
    await expect(
      canvas.queryByRole('button', { name: 'Invite' })
    ).not.toBeInTheDocument();
  },
};

/** The host riding in Light Cycles: End in row 1, the same frame. */
export const LightCyclesHost: Story = { args: HOST };

/** Hearts with a card picked: Cancel and Play, bots in two seats. */
export const HeartsGuest: Story = { args: { game: 'hearts' } };

/** Hearts seen by the host, who can manage the bots from their sheets. */
export const HeartsHost: Story = { args: { game: 'hearts', ...HOST } };

/** Battleship with a square aimed: Surrender and Fire at C4. */
export const BattleshipGuest: Story = { args: { game: 'battleship' } };

/** Battleship seen by the host. */
export const BattleshipHost: Story = { args: { game: 'battleship', ...HOST } };

/** Word Tiles with tiles placed: Recall and Play with the points. */
export const WordTilesGuest: Story = { args: { game: 'wordTiles' } };

/** Word Tiles seen by the host. */
export const WordTilesHost: Story = { args: { game: 'wordTiles', ...HOST } };
