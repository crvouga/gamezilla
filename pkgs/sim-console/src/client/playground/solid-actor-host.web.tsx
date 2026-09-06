/**
 * Web host for a Solid product `App` inside the React console: a plain DOM
 * element owned by React, with a Solid root rendered into it (`solid-js/web`
 * `render` is framework-agnostic at the DOM level). Disposed on unmount or
 * when `App` changes (snapshot reload remounts via the parent `key`).
 */

import { useEffect, useRef } from 'react';
import type { Component as SolidComponent } from 'solid-js';
import { createComponent, render } from 'solid-js/web';

export function SolidActorHost(props: {
  readonly title: string;
  readonly App: SolidComponent<{ readonly embedded?: boolean }>;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const { App } = props;
  useEffect(() => {
    const host = hostRef.current;
    if (host === null) return undefined;
    const dispose = render(
      () => createComponent(App, { embedded: true }),
      host
    );
    return () => {
      dispose();
    };
  }, [App]);
  return <div ref={hostRef} title={props.title} style={hostStyle} />;
}

const hostStyle = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  width: '100%',
  height: '100%',
  minHeight: 0,
  minWidth: 0,
  position: 'relative',
  overflow: 'hidden',
} as const;
