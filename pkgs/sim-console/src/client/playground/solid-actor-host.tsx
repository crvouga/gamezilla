import { Text } from '@pkgs/ui-rn';
import type { ReactNode } from 'react';
import type { Component as SolidComponent } from 'solid-js';

/** Native fallback — Solid actors mount into a DOM element on web only. */
export function SolidActorHost(props: {
  readonly title: string;
  readonly App: SolidComponent<{ readonly embedded?: boolean }>;
}): ReactNode {
  return (
    <Text sx={{ p: 3, color: 'muted' }}>
      {props.title}: the Solid product App renders in the web console only.
    </Text>
  );
}
