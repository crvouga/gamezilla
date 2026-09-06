import { Text } from '@pkgs/ui-rn';
import type { ReactNode } from 'react';

/** Native fallback — embed localhost actor URLs on web only. */
export function ActorUrlFrame(props: {
  readonly title: string;
  readonly url: string;
}): ReactNode {
  return (
    <Text sx={{ p: 3, color: 'muted' }}>
      {props.title}: open {props.url} in a browser (URL actors are web-only).
    </Text>
  );
}
