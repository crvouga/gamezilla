import { MULTIPLAYER_LINK_ROUTE } from '@libs/game-matchmaking-shared-ts/multiplayer-link';
import { defineSubClient } from '@libs/sub-client-ts/client';
import { Trans } from '@lingui/solid/macro';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { useLocalSearchParams } from '@pkgs/ui-root-client-ts/app-router';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { type JSX, Show } from 'solid-js';
import { MultiplayerLinkScreen } from './multiplayer-link-screen';

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
        <ContentScreen screenId="multiplayer-link-unavailable" breadcrumbs={[]}>
          <ErrorState
            title={<Trans>This game is unavailable.</Trans>}
            body={
              <Trans>
                The link may be out of date. Pick a game from your list.
              </Trans>
            }
          />
        </ContentScreen>
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
