/** @jsxImportSource solid-js */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';

/** `navigationTitle` (18) in a compact bar, `subtitle` (21) in a wide one. */
export type ChromeTitleSize = 'navigationTitle' | 'subtitle';

export type ChromeTitleProps = {
  /** Text content. */
  children?: JSX.Element | undefined;
  /** Default `navigationTitle`. */
  size?: ChromeTitleSize | undefined;
  /** Rendered as `data-testid`. */
  testId?: string | undefined;
};

const SIZE: Readonly<Record<ChromeTitleSize, string>> = {
  navigationTitle: 'textNavigationTitle',
  subtitle: 'textSubtitle',
};

/**
 * `ChromeTitle` -- the one-line title a host's chrome bar shows for what it
 * holds (the space name above the game inside it). It is not the page
 * heading: the embedded screen below owns the `h1` (`ScreenIntro`), so this
 * is plain text in a display size, clamped to one line. A routed screen's
 * own title is `TopBarTitle`.
 *
 * @example
 * ```tsx
 * <TopBar center={<ChromeTitle>{spaceName()}</ChromeTitle>} … />
 * <ChromeTitle size="subtitle">{spaceName()}</ChromeTitle>
 * ```
 */
export function ChromeTitle(props: ChromeTitleProps): JSX.Element {
  return (
    <p
      class={`text ${SIZE[props.size ?? 'navigationTitle']} line-clamp-1 min-w-0 max-w-full`}
      data-testid={props.testId}
      data-component={componentId('ChromeTitle')}
    >
      {props.children}
    </p>
  );
}
