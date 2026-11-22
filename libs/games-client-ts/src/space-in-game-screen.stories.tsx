import SpaceInGameChessExample from '@pkgs/chess-board-root-client-ts/chess-board/space-chess.example';
import { SpaceInGameTemplate } from '@pkgs/ui-root-client-ts/space-in-game-template';
import SpaceInGameTemplateExample, {
  type SpaceInGameTemplateExampleProps,
} from '@pkgs/ui-root-client-ts/space-in-game-template/space-in-game-template.example';
import type { SpaceRole } from '@pkgs/ui-root-client-ts/space-types';
import { type JSX, Show } from 'solid-js';
import { expect, fn, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  SPACE_STORY_GAMES,
  SPACE_STORY_ROLES,
  type SpaceMatrix,
  type SpaceStoryGame,
  spaceStoryGame,
  spaceStoryRole,
} from './space-screen-story.example';

type Args = Omit<SpaceInGameTemplateExampleProps, 'game' | 'role'>;

/** The `@pkgs/ui` fixture of each game whose board `@pkgs/ui` draws. */
type PlayGame = Exclude<SpaceStoryGame, 'chess'>;

const PLAY_FIXTURE = {
  'light-cycles': 'lightCycles',
  hearts: 'hearts',
  battleship: 'battleship',
  'word-tiles': 'wordTiles',
} as const satisfies Record<PlayGame, SpaceInGameTemplateExampleProps['game']>;

/** Chess draws its own board, so its in-game moment lives in its package. */
function SpaceInGameExample(
  props: Args & { globals: Readonly<Record<string, unknown>> }
): JSX.Element {
  const role = (): SpaceRole => spaceStoryRole(props.globals);
  const game = (): SpaceStoryGame => spaceStoryGame(props.globals);
  return (
    <Show
      when={game() !== 'chess' && PLAY_FIXTURE[game() as PlayGame]}
      fallback={<SpaceInGameChessExample {...props} role={role()} />}
    >
      {(fixture) => (
        <SpaceInGameTemplateExample {...props} game={fixture()} role={role()} />
      )}
    </Show>
  );
}

const meta = {
  id: 'space-in-game',
  title: 'Space/InGame',
  component: SpaceInGameTemplate,
  tags: ['autodocs', 'viewport-responsive'],
  args: {
    onBack: fn(),
    onSettings: fn(),
    onLeave: fn(),
    onEnd: fn(),
    onPersonAction: fn(),
    onInvite: fn(),
    onGameAction: fn(),
  },
  parameters: { layout: 'fullscreen', controls: { disable: true } },
  render: (args, { globals }) => (
    <SpaceInGameExample {...args} globals={globals} />
  ),
} satisfies Meta<Args>;
export default meta;

type Story = StoryObj<Args>;

/**
 * bob's space while the toolbar's game is played, seen by the toolbar's
 * role: player-color rings and each seat's data line, the game's own
 * actions in the action bar, End for the host and Leave for a guest in row
 * 1, and no Invite while a game runs. Pressing a person opens their sheet
 * over the stage.
 */
export const Screen: Story = {
  parameters: {
    spaceMatrix: {
      games: SPACE_STORY_GAMES,
      roles: SPACE_STORY_ROLES,
    } satisfies SpaceMatrix,
  },
  play: async ({ canvasElement, globals }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', {
        name: spaceStoryRole(globals) === 'host' ? 'End' : 'Leave',
      })
    ).toBeVisible();
    await expect(
      canvas.queryByRole('button', { name: 'Invite' })
    ).not.toBeInTheDocument();
  },
};
