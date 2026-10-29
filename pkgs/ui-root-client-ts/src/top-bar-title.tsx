/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';

export type TopBarTitleProps = {
  label: JSX.Element;
};

/**
 * Single-line screen title (`h1`) in the `heading` role (the brief's 18/24
 * bold title style), left-aligned after the back control; the `TopBar` slot
 * sets alignment and a long title truncates with an ellipsis.
 */
export function TopBarTitle(props: TopBarTitleProps): JSX.Element {
  return (
    <h1 class="text textHeading line-clamp-1 min-w-0 max-w-full">
      {props.label}
    </h1>
  );
}
