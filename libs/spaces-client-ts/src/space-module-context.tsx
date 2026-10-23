import type { SpaceModule } from '@libs/spaces-shared-ts/space-module';
import { defineContext } from '@pkgs/solid-context-client-ts/define-context';
import type { JSX } from 'solid-js';

export type SpaceRoomModule = SpaceModule;

const SpaceModuleContext = defineContext<SpaceRoomModule>('SpaceModule');

export type SpaceModuleProviderProps = {
  /** Composed `SpaceModule`, built by the composition root via `createSpaceModule(name, games)`. */
  readonly value: SpaceRoomModule;
  readonly children: JSX.Element;
};

/**
 * Provides the composed `SpaceModule` to every component that needs to open
 * a {@link Room}. Mount at the composition root with the constructed module:
 *
 * ```tsx
 * <SpaceModuleProvider value={createSpaceModule(name, [chessGameShared])}>
 *   ...
 * </SpaceModuleProvider>
 * ```
 *
 * Keeps `@libs/spaces` ignorant of any specific game and lets the
 * composition root own the full game registry.
 */
export function SpaceModuleProvider(
  props: SpaceModuleProviderProps
): JSX.Element {
  return (
    <SpaceModuleContext.Provider value={props.value}>
      {props.children}
    </SpaceModuleContext.Provider>
  );
}

/**
 * Read the composed `SpaceModule` from context. Crashes if no provider is
 * mounted -- the composition root is required to wire one.
 */
export function useSpaceModule(): SpaceRoomModule {
  return SpaceModuleContext.use();
}
