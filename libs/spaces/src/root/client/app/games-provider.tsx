/** @jsxImportSource solid-js */
/**
 * Always mounts {@link GamesBootstrapFromPlugins} so shell chrome that opens
 * space rooms (`SpaceOpenRoomsProvider`, miniplayer) has `SpaceModuleProvider`.
 *
 * Heavy `@libs/games/game-plugins.client` still loads only under `/space/*`
 * (see docs/LOW_END_ANDROID_PERF.md). Empty registries cover non-space routes.
 */
import {
  GamesBootstrapFromPlugins,
  type GamesBootstrapFromPluginsProps,
} from '@libs/spaces/root/client/module/games-bootstrap-from-plugins';
import { useLocation } from '@solidjs/router';
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  type JSX,
  Show,
} from 'solid-js';

type GameRegistry = Pick<GamesBootstrapFromPluginsProps, 'games' | 'clients'>;

const EMPTY_REGISTRY: GameRegistry = {
  games: [],
  clients: [],
};

export function AppGamesProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const location = useLocation();
  const onSpaceRoute = createMemo(() =>
    location.pathname.startsWith('/space/')
  );
  // Source falsy → resource idle (fetcher not called). Truthy → always load.
  const [plugins] = createResource(onSpaceRoute, async () => {
    const mod = await import('@libs/games/game-plugins.client');
    return {
      games: mod.GAME_DEFINITIONS,
      clients: mod.GAME_CLIENT_DEFINITIONS,
    } satisfies GameRegistry;
  });

  // Retain the last successful registry across navigations away from `/space/*`
  // (`createResource` clears when the source goes falsy).
  const [held, setHeld] = createSignal<GameRegistry | null>(null);
  createEffect(() => {
    const current = plugins();
    if (current != null) setHeld(current);
  });

  const registry = createMemo((): GameRegistry => held() ?? EMPTY_REGISTRY);

  // `GamesBootstrapFromPlugins` reads games/clients once (untrack). Key so
  // empty → loaded remounts with the real registry.
  return (
    <Show when={registry()} keyed>
      {(reg) => (
        <GamesBootstrapFromPlugins games={reg.games} clients={reg.clients}>
          {props.children}
        </GamesBootstrapFromPlugins>
      )}
    </Show>
  );
}
