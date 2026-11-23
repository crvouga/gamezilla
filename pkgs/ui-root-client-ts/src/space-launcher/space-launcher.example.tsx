import {
  SpaceLauncher,
  type SpaceLauncherGame,
} from '@pkgs/ui-root-client-ts/space-launcher';
import { SpaceStageTemplate } from '@pkgs/ui-root-client-ts/space-stage-template';
import type { SpaceRole } from '@pkgs/ui-root-client-ts/space-types';
import type { JSX } from 'solid-js';
import {
  SpaceExampleFrame,
  type SpaceExampleSpies,
  spaceExampleChrome,
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

/**
 * bob's space while bob chooses a game, seen by `role`: the launcher as
 * the page of the space's stage template, as the app frames it.
 */
export default function SpaceLauncherExample(
  props: SpaceLauncherExampleProps
): JSX.Element {
  const people = () =>
    spaceExamplePeople({ role: props.role, phase: 'choosing' });
  return (
    <SpaceExampleFrame>
      <SpaceStageTemplate
        {...spaceExampleChrome(props, true)}
        role={props.role}
        title="Choose game"
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
      </SpaceStageTemplate>
    </SpaceExampleFrame>
  );
}
