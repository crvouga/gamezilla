/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';

export type ModalBackdropProps = {
  /** Fired on click outside the content (when `dismissOnBackdrop`). */
  onClick: () => void;
  /** When `false`, clicks on the scrim are ignored. Default `true`. */
  dismissOnBackdrop?: boolean | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
  children?: JSX.Element | undefined;
};

/**
 * `ModalBackdrop` -- semi-transparent scrim that dismisses on click outside.
 *
 * Uses the active `scrim` token so light and dark schemes both get a
 * scene-appropriate backdrop. The centering layer is pointer-transparent
 * (`.boxNone`) so clicks beside the content reach the scrim; the scrim itself
 * is a non-focusable, `aria-hidden` layer -- keyboard users dismiss with
 * Escape through the surrounding {@link FocusTrap}.
 *
 * The scrim fades in over 200ms (`.scrimEnter`); the content keeps the
 * 16px modal margin (`MODAL_CONTENT_MARGIN_STEP`, `p-4`) from every edge.
 *
 * Relies on a sized ancestor (the {@link ModalRoot} focus trap fills the
 * surface layer) so this fill expands to the viewport.
 */
export function ModalBackdrop(props: ModalBackdropProps): JSX.Element {
  const onScrimClick = (): void => {
    if (props.dismissOnBackdrop ?? true) props.onClick();
  };
  return (
    <div
      class="box flex-1 w-full h-full"
      {...dataAttrs({ component: 'ModalBackdrop', ...props.dataSet })}
    >
      <div
        class="box scrimEnter absolute inset-0 bg-scrim"
        data-component="ModalScrim"
        aria-hidden="true"
        onClick={onScrimClick}
      />
      <div
        class="box flex-1 w-full h-full justify-center items-center p-4"
        classList={{ boxNone: true }}
      >
        {props.children}
      </div>
    </div>
  );
}
