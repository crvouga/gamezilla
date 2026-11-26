import type { JSX } from '@solidjs/web';
import { createContext, createSignal, useContext } from 'solid-js';

export type SpaceManagementPage =
  | { readonly area: 'people'; readonly tab: 'people' | 'sharing' }
  | {
      readonly area: 'settings';
      readonly tab: 'general' | 'people' | 'sharing';
    };

function managementState(spaceId: () => string) {
  return createSignal<SpaceManagementPage | null>(() => {
    spaceId();
    return null;
  });
}

const Management = createContext<ReturnType<typeof managementState>>();

export function SpaceManagementProvider(props: {
  readonly spaceId: string;
  readonly children: JSX.Element;
}): JSX.Element {
  const state = managementState(() => props.spaceId);
  return <Management value={state}>{props.children}</Management>;
}

/** The route keeps the open page across reconnects and resets it for another space. */
export function useSpaceManagement() {
  return useContext(Management);
}
