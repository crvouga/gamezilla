/** @jsxImportSource solid-js */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';

export type VisuallyHiddenProps = {
  /** Text content. */
  children?: JSX.Element | undefined;
  id?: string | undefined;
  /** Rendered as `data-testid`. */
  testId?: string | undefined;
  /** `status` and `alert` announce changes to the content. */
  role?: 'status' | 'alert' | undefined;
  'aria-live'?: 'off' | 'polite' | 'assertive' | undefined;
  /** Announce the whole content, not only what changed. */
  'aria-atomic'?: boolean | undefined;
};

/**
 * `VisuallyHidden` -- text for assistive technology only (was `sr-only`):
 * the name of an icon-only region, a status that sighted users read from
 * the layout, a live announcement.
 *
 * It takes no space and paints nothing, but stays in the accessibility tree
 * and in the DOM, so a test can read it too.
 *
 * @example
 * ```tsx
 * <VisuallyHidden role="status" aria-live="polite">{t`Puzzle solved`}</VisuallyHidden>
 * ```
 */
export function VisuallyHidden(props: VisuallyHiddenProps): JSX.Element {
  return (
    <span
      class="sr-only"
      id={props.id}
      data-testid={props.testId}
      data-component={componentId('VisuallyHidden')}
      role={props.role}
      aria-live={props['aria-live']}
      aria-atomic={props['aria-atomic']}
    >
      {props.children}
    </span>
  );
}
