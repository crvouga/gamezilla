/**
 * Provides the composed space event-log describe router (including game
 * describeEvents) so chrome and attribution stay game-agnostic.
 */

import type { EventLogRouter } from '@pkgs/collab';
import { defineContext } from '@pkgs/solid-context/define-context';
import type { JSX, ParentProps } from 'solid-js';

const SpaceEventLogRouterContext = defineContext<EventLogRouter>(
  'SpaceEventLogRouter'
);

export type SpaceEventLogRouterProviderProps = {
  readonly value: EventLogRouter;
  readonly children: JSX.Element;
};

export function SpaceEventLogRouterProvider(
  props: ParentProps<SpaceEventLogRouterProviderProps>
): JSX.Element {
  return (
    <SpaceEventLogRouterContext.Provider value={props.value}>
      {props.children}
    </SpaceEventLogRouterContext.Provider>
  );
}

/**
 * Read the composed event-log router. Crashes if no provider is mounted —
 * {@link GamesBootstrapFromPlugins} must wrap the tree.
 */
export function useSpaceEventLogRouter(): EventLogRouter {
  return SpaceEventLogRouterContext.use();
}
