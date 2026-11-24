import { SpaceSetupTemplate } from '@pkgs/ui-root-client-ts/space-setup-template';
import type { SpaceRole } from '@pkgs/ui-root-client-ts/space-types';
import type { JSX } from '@solidjs/web';
import { createMemo } from 'solid-js';
import {
  SpaceExampleFrame,
  type SpaceExampleSpies,
  spaceExampleChrome,
} from '../../storybook/fixtures/space-example-frame';
import {
  type SpaceExampleGameKey,
  spaceExampleBots,
  spaceExampleGame,
} from '../../storybook/fixtures/space-example-games';
import {
  SPACE_EXAMPLE_HOST_NAME,
  spaceExamplePeople,
} from '../../storybook/fixtures/space-example-people';

export type SpaceSetupTemplateExampleProps = SpaceExampleSpies & {
  game: SpaceExampleGameKey;
  role: SpaceRole;
  /** Whether ana said she is ready. */
  ready: boolean;
  onReadyChange: (ready: boolean) => void;
  onStart: () => void;
  onChangeGame: () => void;
  onGameAction: (id: string) => void;
};

/** bob's space while bob sets up `game`, seen by `role`. */
export default function SpaceSetupTemplateExample(
  props: SpaceSetupTemplateExampleProps
): JSX.Element {
  const game = createMemo(() =>
    spaceExampleGame(props.game, props.role, (id) => props.onGameAction(id))
  );
  const people = () =>
    spaceExamplePeople({
      role: props.role,
      phase: 'settingUp',
      bots: spaceExampleBots(props.game),
      ready: props.ready,
    });
  return (
    <SpaceExampleFrame>
      <SpaceSetupTemplate
        {...spaceExampleChrome(props, true)}
        game={game()}
        role={props.role}
        hostName={SPACE_EXAMPLE_HOST_NAME}
        people={people()}
        onReadyChange={(ready) => props.onReadyChange(ready)}
        onStart={() => props.onStart()}
        canStart={props.ready}
        startNote={
          props.ready ? 'Everyone is ready.' : 'Waiting for ana to be ready.'
        }
        onChangeGame={() => props.onChangeGame()}
      />
    </SpaceExampleFrame>
  );
}
