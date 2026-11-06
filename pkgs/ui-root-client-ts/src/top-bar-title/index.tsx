/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';

export type TopBarTitleProps = {
  label: JSX.Element;
  /**
   * `regular` (default): the `heading` role beside a back control. `large`:
   * the `title` role (26/30), for a root screen with nothing before it, so a
   * tab opens with the same title size as a screen's own `ScreenIntro`.
   */
  size?: 'regular' | 'large' | undefined;
};

/**
 * Single-line screen title (`h1`) in the `heading` role (the brief's 18/24
 * bold title style), left-aligned after the back control; the `TopBar` slot
 * sets alignment and a long title truncates with an ellipsis.
 */
export function TopBarTitle(props: TopBarTitleProps): JSX.Element {
  return (
    <h1
      class="text line-clamp-1 min-w-0 max-w-full"
      classList={{
        textHeading: props.size !== 'large',
        textTitle: props.size === 'large',
      }}
    >
      {props.label}
    </h1>
  );
}
