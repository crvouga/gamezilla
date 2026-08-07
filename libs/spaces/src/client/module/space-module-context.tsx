import type { Message } from '@pkgs/message';
import type { RoomModule, RoomState } from '@pkgs/room';
import { createContext, type ReactNode, useContext } from 'react';

export type SpaceRoomModule = RoomModule<RoomState, Message, Message, string>;

const SpaceModuleContext = createContext<SpaceRoomModule | null>(null);

export type SpaceModuleProviderProps = {
  /** Composed `SpaceModule`, built by the composition root via `createSpaceModule(name, games)`. */
  readonly value: SpaceRoomModule;
  readonly children: ReactNode;
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
export function SpaceModuleProvider({
  value,
  children,
}: SpaceModuleProviderProps): ReactNode {
  return (
    <SpaceModuleContext.Provider value={value}>
      {children}
    </SpaceModuleContext.Provider>
  );
}

/**
 * Read the composed `SpaceModule` from context. Crashes if no provider is
 * mounted -- the composition root is required to wire one.
 */
export function useSpaceModule(): SpaceRoomModule {
  const module = useContext(SpaceModuleContext);
  if (module === null) {
    throw new Error(
      'useSpaceModule: no <SpaceModuleProvider> in tree. Wrap the app root in one.'
    );
  }
  return module;
}
