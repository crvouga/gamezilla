import type { DebuggerChromeNav } from './debugger-chrome';

export type UnifiedTopology = {
  readonly clients: readonly { readonly id: string }[];
  readonly servers: readonly { readonly id: string }[];
  readonly loadBalancerId: string;
};

/**
 * Resolve unified-strip selection against the stable client / server lists
 * (not kind-scoped pane instances — those drop clients on Server/Room).
 */
export function selectUnifiedNode(
  props: {
    readonly chrome: DebuggerChromeNav;
    readonly onFocusedClientIdChange: (id: string | null) => void;
  },
  topology: UnifiedTopology,
  id: string
): void {
  if (topology.clients.some((actor) => actor.id === id)) {
    props.chrome.onKindChange('client');
    props.chrome.onInstanceChange(id);
    props.onFocusedClientIdChange(id);
    return;
  }
  if (id === topology.loadBalancerId) {
    props.chrome.onKindChange('lb');
    return;
  }
  if (topology.servers.some((server) => server.id === id)) {
    props.chrome.onKindChange('server');
    props.chrome.onInstanceChange(id);
    return;
  }
  if (id === 'events') {
    props.chrome.onKindChange('events');
    return;
  }
  props.chrome.onKindChange('room');
  props.chrome.onInstanceChange(id);
}
