import type { JSX } from 'solid-js';
import { ExampleRoot } from './example-root';

/** A bounded viewport so screen examples exercise scrolling and pinned chrome. */
export function ScreenExampleFrame(props: {
  children: JSX.Element;
}): JSX.Element {
  return (
    <ExampleRoot class="h-160 min-h-0 overflow-hidden rounded-card border border-border">
      {props.children}
    </ExampleRoot>
  );
}
