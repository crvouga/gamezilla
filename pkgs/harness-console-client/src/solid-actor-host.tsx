import type { ProductHarnessMemoryHistory } from '@pkgs/harness-console-shared/ports';
import type { Component as SolidComponent } from 'solid-js';
import { Dynamic } from 'solid-js/web';

/**
 * Hosts a Solid product `App` inside the console (web). `Dynamic` remounts
 * when `App` changes (snapshot reload also remounts via the parent key).
 * `history` is owned by the session actor so the MemoryRouter location
 * survives `snapshotEpoch` remounts.
 */
export function SolidActorHost(props: {
  readonly title: string;
  readonly App: SolidComponent<{
    readonly embedded?: boolean;
    readonly history?: ProductHarnessMemoryHistory;
  }>;
  readonly history: ProductHarnessMemoryHistory;
}) {
  return (
    <div title={props.title} style={hostStyle}>
      <Dynamic component={props.App} embedded={true} history={props.history} />
    </div>
  );
}

const hostStyle = {
  display: 'flex',
  'flex-direction': 'column',
  flex: '1',
  width: '100%',
  height: '100%',
  'min-height': '0',
  'min-width': '0',
  position: 'relative',
  overflow: 'clip',
  'overflow-anchor': 'none',
} as const;
