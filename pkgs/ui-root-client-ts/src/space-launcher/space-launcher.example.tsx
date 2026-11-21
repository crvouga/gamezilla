import {
  SpaceLauncher,
  type SpaceLauncherGame,
} from '@pkgs/ui-root-client-ts/space-launcher';
import { SpacePeople } from '@pkgs/ui-root-client-ts/space-person-sheet/space-people';
import { SpaceShell } from '@pkgs/ui-root-client-ts/space-shell';
import type { SpaceRole } from '@pkgs/ui-root-client-ts/space-types';
import type { JSX } from 'solid-js';
import {
  SpaceExampleFrame,
  type SpaceExampleSpies,
} from '../../storybook/fixtures/space-example-frame';
import {
  SPACE_EXAMPLE_HOST_NAME,
  spaceExamplePeople,
} from '../../storybook/fixtures/space-example-people';

/** Every game in the launcher, as data; the launcher never names one. */
export const SPACE_EXAMPLE_LAUNCHER_GAMES: readonly SpaceLauncherGame[] = [
  {
    key: 'chess',
    name: 'Chess',
    motif: 'checkered',
    players: { counts: [2], bots: true },
  },
  {
    key: 'connect-four',
    name: 'Connect Four',
    motif: 'discs',
    players: { counts: [2], bots: true },
  },
  {
    key: 'battleship',
    name: 'Battleship',
    motif: 'fleet',
    players: { counts: [2], bots: true },
  },
  {
    key: 'pong',
    name: 'Pong',
    motif: 'court',
    players: { counts: [2], bots: true },
  },
  {
    key: 'quoridor',
    name: 'Quoridor',
    motif: 'walls',
    players: { counts: [2, 4], bots: true },
  },
  {
    key: 'word-tiles',
    name: 'Word Tiles',
    motif: 'letters',
    players: { counts: [2, 3, 4], bots: false },
  },
  {
    key: 'light-cycles',
    name: 'Light Cycles',
    motif: 'trails',
    players: { counts: [2, 3, 4], bots: false },
  },
  {
    key: 'hearts',
    name: 'Hearts',
    motif: 'cards',
    players: { counts: [4], bots: true },
  },
  {
    key: 'numberlink',
    name: 'Numberlink',
    motif: 'paths',
    players: { counts: [1], bots: false },
  },
  {
    key: 'sokoban',
    name: 'Sokoban',
    motif: 'crates',
    players: { counts: [1], bots: false },
  },
];

/** Who suggested which game: ana suggested Pong. */
function withSuggestion(role: SpaceRole): readonly SpaceLauncherGame[] {
  return SPACE_EXAMPLE_LAUNCHER_GAMES.map((game) =>
    game.key === 'pong'
      ? { ...game, suggestedBy: { name: 'ana', you: role === 'guest' } }
      : game
  );
}

export type SpaceLauncherExampleProps = SpaceExampleSpies & {
  role: SpaceRole;
  onChoose: (key: string) => void;
  onSuggest: (key: string) => void;
};

/** bob's space while bob chooses a game, seen by `role`. */
export default function SpaceLauncherExample(
  props: SpaceLauncherExampleProps
): JSX.Element {
  const people = () =>
    spaceExamplePeople({ role: props.role, phase: 'choosing' });
  return (
    <SpaceExampleFrame>
      <SpaceShell
        spaceName="bob’s space"
        role={props.role}
        onBack={() => props.onBack()}
        onSettings={() => props.onSettings()}
        onLeave={() => props.onLeave()}
        onEnd={() => props.onEnd()}
        people={
          <SpacePeople
            people={people()}
            viewer={props.role}
            phase="choosing"
            onPersonAction={(id, action) => props.onPersonAction(id, action)}
            onInvite={() => props.onInvite()}
          />
        }
      >
        <SpaceLauncher
          role={props.role}
          hostName={SPACE_EXAMPLE_HOST_NAME}
          present={people().length}
          games={withSuggestion(props.role)}
          lookingAt="light-cycles"
          onChoose={(key) => props.onChoose(key)}
          onSuggest={(key) => props.onSuggest(key)}
        />
      </SpaceShell>
    </SpaceExampleFrame>
  );
}
