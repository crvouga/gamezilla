import { SpaceInGameTemplate } from '@pkgs/ui-root-client-ts/space-in-game-template';
import type { SpaceRole } from '@pkgs/ui-root-client-ts/space-types';
import type { JSX } from 'solid-js';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { spaceChessGame, spaceChessPeople } from './space-chess-fixture';

type SpaceInGameChessArgs = {
  /** Who is looking: the host is bob (White), a guest is ana (Black). */
  role: SpaceRole;
};

function ignore(): void {
  // Storybook fixture: actions and chrome go nowhere.
}

/** A chess game in a space, at one fixed mid-game moment, from `role`. */
function SpaceInGameChess(props: SpaceInGameChessArgs): JSX.Element {
  return (
    <SpaceInGameTemplate
      spaceName="Friday night"
      role={props.role}
      game={spaceChessGame(props.role, ignore)}
      people={spaceChessPeople(props.role)}
      onBack={ignore}
      onSettings={ignore}
      onLeave={ignore}
      onEnd={ignore}
      onPersonAction={ignore}
    />
  );
}

const meta = {
  id: 'space-in-game-chess',
  title: 'Space/InGame/Template/Chess',
  render: (args) => <SpaceInGameChess role={args.role} />,
  parameters: { layout: 'fullscreen' },
  argTypes: {
    role: { control: 'inline-radio', options: ['host', 'guest'] },
  },
  args: { role: 'guest' },
} satisfies Meta<SpaceInGameChessArgs>;
export default meta;

type Story = StoryObj<typeof meta>;

/** bob, the host, plays White and is to move. */
export const Host: Story = { args: { role: 'host' } };

/** ana, a guest, plays Black and is to move. */
export const Guest: Story = { args: { role: 'guest' } };
