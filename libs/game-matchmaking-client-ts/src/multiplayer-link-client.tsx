import { MULTIPLAYER_LINK_ROUTE } from '@libs/game-matchmaking-shared-ts/multiplayer-link';
import { defineSubClient } from '@libs/sub-client-ts/client';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { useLocalSearchParams } from '@pkgs/ui-root-client-ts/app-router';
import { type JSX, Show } from 'solid-js';
import { MultiplayerLinkScreen } from './multiplayer-link-screen';
import { MultiplayerLinkScreenView } from './multiplayer-link-screen-view';

function RegisteredGameLink(props: { rules: TurnGames }): JSX.Element {
  const params = useLocalSearchParams<{ gameId?: string }>();
  const gameId = () => {
    const id = params().gameId;
    return id !== undefined && props.rules.offers(id, 'matchmaking')
      ? id
      : undefined;
  };
  return (
    <Show
      when={gameId()}
      keyed
      fallback={
        <MultiplayerLinkScreenView
          status="unavailable"
          onRetry={() => undefined}
          onGoToSpaces={() => undefined}
        />
      }
    >
      {(id) => <MultiplayerLinkScreen gameId={id} />}
    </Show>
  );
}
/** One route keeps existing game links stable and admits only games offering matchmaking. */
export function createMultiplayerLinkClient(rules: TurnGames) {
  return defineSubClient({
    name: 'multiplayer-link',
    routes: [
      {
        path: MULTIPLAYER_LINK_ROUTE,
        component: () => <RegisteredGameLink rules={rules} />,
      },
    ],
  });
}
