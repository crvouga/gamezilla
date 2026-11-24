import type { JSX } from '@solidjs/web';
import { ExampleRoot } from './example-root';

/** A bounded viewport so screen examples exercise scrolling and pinned chrome. */
export function ScreenExampleFrame(props: {
  children: JSX.Element;
}): JSX.Element {
  return <ExampleRoot bounded>{props.children}</ExampleRoot>;
}
