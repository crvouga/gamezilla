import { MULTIPLAYER_LINK_ROUTE } from '@libs/game-matchmaking-shared/multiplayer-link';
import { defineSubClient } from '@libs/sub-client/client';
import { Trans } from '@lingui/solid/macro';
import type { TurnGames } from '@pkgs/turn-game-shared/game-rules';
import { useLocalSearchParams } from '@pkgs/ui-root-client/app-router';
import { ContentScreen } from '@pkgs/ui-root-client/content-screen';
import { ErrorState } from '@pkgs/ui-root-client/error-state';
import { type JSX, Show } from 'solid-js';
import { MultiplayerLinkScreen } from './multiplayer-link-screen';

function RegisteredGameLink(props: { rules: TurnGames }): JSX.Element {
  const params = useLocalSearchParams<{ gameId?: string }>();
  const gameId = () =>
    props.rules.games.find((game) => game.rules.id === params().gameId)?.rules
      .id;
  return (
    <Show
      when={gameId()}
      keyed
      fallback={
        <ContentScreen screenId="multiplayer-link-unavailable" breadcrumbs={[]}>
          <ErrorState title={<Trans>This game is unavailable.</Trans>} />
        </ContentScreen>
      }
    >
      {(id) => <MultiplayerLinkScreen gameId={id} />}
    </Show>
  );
}
/** One route keeps existing game links stable and admits only registered games. */
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
