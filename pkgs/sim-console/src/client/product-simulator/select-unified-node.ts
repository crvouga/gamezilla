import type { DebuggerChromeNav } from '../debugger-chrome';

/**
 * Resolve unified-strip selection against the stable client list
 * (not kind-scoped pane instances — those drop clients on Server/Room).
 */
export function selectUnifiedNode(
  props: {
    readonly chrome: DebuggerChromeNav;
    readonly onFocusedClientIdChange: (id: string | null) => void;
  },
  clients: readonly { readonly id: string }[],
  id: string
): void {
  if (clients.some((actor) => actor.id === id)) {
    props.chrome.onKindChange('client');
    props.chrome.onInstanceChange(id);
    props.onFocusedClientIdChange(id);
    return;
  }
  if (id === 'server') {
    props.chrome.onKindChange('server');
    return;
  }
  if (id === 'events') {
    props.chrome.onKindChange('events');
    return;
  }
  props.chrome.onKindChange('room');
  props.chrome.onInstanceChange(id);
}
