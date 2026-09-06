import type { Component as SolidComponent } from 'solid-js';
import { Dynamic } from 'solid-js/web';

/**
 * Hosts a Solid product `App` inside the console (web). `Dynamic` remounts
 * when `App` changes (snapshot reload also remounts via the parent key).
 */
export function SolidActorHost(props: {
  readonly title: string;
  readonly App: SolidComponent<{ readonly embedded?: boolean }>;
}) {
  return (
    <div title={props.title} style={hostStyle}>
      <Dynamic component={props.App} embedded={true} />
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
  overflow: 'hidden',
} as const;
