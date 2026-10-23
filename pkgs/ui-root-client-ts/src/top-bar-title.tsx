/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';

export type TopBarTitleProps = {
  label: JSX.Element;
  /**
   * A root screen (a tab, nothing to go back to) announces itself in the
   * heading role; a pushed screen uses the quieter navigation title.
   */
  root?: boolean | undefined;
};

/** Single-line navigation title (`h1`); the `TopBar` slot sets alignment. */
export function TopBarTitle(props: TopBarTitleProps): JSX.Element {
  return (
    <h1
      class="text line-clamp-1 min-w-0 max-w-full"
      classList={{
        textHeading: props.root === true,
        textNavigationTitle: props.root !== true,
      }}
    >
      {props.label}
    </h1>
  );
}
