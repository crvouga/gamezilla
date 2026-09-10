/** @jsxImportSource solid-js */
/**
 * Lazy-loads game plugins so chess UI stays off the low-end Android critical
 * path (see docs/low-end-android-perf.md).
 */
import { GamesBootstrapFromPlugins } from '@libs/spaces/root/client/module/games-bootstrap-from-plugins';
import { createResource, type JSX, Show } from 'solid-js';
import { BootLoadingShell } from '../boot/boot-loading-shell';

export function AppGamesProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const [plugins] = createResource(
    () => import('@libs/games/game-plugins.client')
  );

  return (
    <Show when={plugins()} fallback={<BootLoadingShell />} keyed>
      {(mod) => (
        <GamesBootstrapFromPlugins
          games={mod.GAME_DEFINITIONS}
          clients={mod.GAME_CLIENT_DEFINITIONS}
        >
          {props.children}
        </GamesBootstrapFromPlugins>
      )}
    </Show>
  );
}
