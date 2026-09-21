/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';

export function AppClientConfig(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  return <>{props.children}</>;
}
