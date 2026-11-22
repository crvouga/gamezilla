import { SpaceInGameTemplate } from '@pkgs/ui-root-client-ts/space-in-game-template';
import type { SpaceRole } from '@pkgs/ui-root-client-ts/space-types';
import { createMemo, type JSX } from 'solid-js';
import {
  SpaceExampleFrame,
  type SpaceExampleSpies,
  spaceExampleChrome,
} from '../../../ui-root-client-ts/storybook/fixtures/space-example-frame';
import {
  spaceChessGame,
  spaceChessPeople,
} from './space-chess-fixture.example';

export type SpaceInGameChessExampleProps = SpaceExampleSpies & {
  /** Who is looking: the host is bob (White), a guest is ana (Black). */
  role: SpaceRole;
  onGameAction: (id: string) => void;
};

/**
 * bob's space while Chess is played, at one fixed mid-game moment, seen by
 * `role`. `@pkgs/ui` cannot draw the chess board, so the Space screen
 * stories take Chess in play from here.
 */
export default function SpaceInGameChessExample(
  props: SpaceInGameChessExampleProps
): JSX.Element {
  const game = createMemo(() =>
    spaceChessGame(props.role, (id) => props.onGameAction(id))
  );
  return (
    <SpaceExampleFrame>
      <SpaceInGameTemplate
        {...spaceExampleChrome(props, false)}
        game={game()}
        role={props.role}
        people={spaceChessPeople(props.role)}
      />
    </SpaceExampleFrame>
  );
}
