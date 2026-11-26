import { SpaceInGameTemplate } from '@pkgs/ui-root-client-ts/space-in-game-template';
import type {
  SpaceGame,
  SpaceGamePlay,
  SpaceRole,
} from '@pkgs/ui-root-client-ts/space-types';
import type { JSX } from '@solidjs/web';
import { createMemo, Show } from 'solid-js';
import {
  SpaceExampleFrame,
  type SpaceExampleSpies,
  spaceExampleChrome,
} from '../../storybook/fixtures/space-example-frame';
import {
  type SpaceExamplePlayKey,
  spaceExampleBots,
  spaceExampleGame,
} from '../../storybook/fixtures/space-example-games';
import { spaceExamplePeople } from '../../storybook/fixtures/space-example-people';

export type SpaceInGameTemplateExampleProps = SpaceExampleSpies & {
  game: SpaceExamplePlayKey;
  role: SpaceRole;
  onGameAction: (id: string) => void;
};

function playing(
  game: SpaceGame
): (SpaceGame & { play: SpaceGamePlay }) | undefined {
  const play = game.play;
  return play === undefined ? undefined : { ...game, play };
}

/** bob's space while `game` is played, seen by `role`. */
export default function SpaceInGameTemplateExample(
  props: SpaceInGameTemplateExampleProps
): JSX.Element {
  const game = createMemo(() =>
    playing(
      spaceExampleGame(props.game, props.role, (id) => props.onGameAction(id))
    )
  );
  return (
    <SpaceExampleFrame>
      <Show when={game()}>
        {(current) => (
          <SpaceInGameTemplate
            {...spaceExampleChrome(props)}
            game={current()}
            role={props.role}
            people={spaceExamplePeople({
              role: props.role,
              phase: 'inGame',
              bots: spaceExampleBots(props.game),
            })}
          />
        )}
      </Show>
    </SpaceExampleFrame>
  );
}
