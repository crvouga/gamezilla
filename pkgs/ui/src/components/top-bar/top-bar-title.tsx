/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';

export type TopBarTitleProps = {
  label: JSX.Element;
};

/** Single-line, centered navigation title (`h1`). */
export function TopBarTitle(props: TopBarTitleProps): JSX.Element {
  return (
    <h1 class="text textNavigationTitle line-clamp-1 text-center">
      {props.label}
    </h1>
  );
}
