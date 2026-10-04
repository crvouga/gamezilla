/** @jsxImportSource solid-js */
/**
 * `ModalBackdrop` -- semi-transparent scrim that dismisses on click outside.
 *
 * Uses the active `scrim` token so light and dark schemes both get a
 * scene-appropriate backdrop. The centering layer is pointer-transparent
 * (`.boxNone`) so clicks beside the content reach the scrim; the scrim itself
 * is a non-focusable, `aria-hidden` layer -- keyboard users dismiss with
 * Escape through the surrounding {@link FocusTrap}.
 *
 * Relies on a sized ancestor (the {@link ModalRoot} focus trap fills the
 * surface layer) so this fill expands to the viewport.
 */

import type { JSX } from 'solid-js';
import type { ComponentDataSet } from '@pkgs/ui-shared/component-id';
import { dataAttrs } from '@pkgs/ui-shared/component-id';
import { cssGap } from '@pkgs/ui-shared/css-px';
import { MODAL_CONTENT_MARGIN_STEP } from '@pkgs/ui-shared/modal-size';

export type ModalBackdropProps = {
  /** Fired on click outside the content (when `dismissOnBackdrop`). */
  onClick: () => void;
  /** When `false`, clicks on the scrim are ignored. Default `true`. */
  dismissOnBackdrop?: boolean | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
  children?: JSX.Element | undefined;
};

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
        class="box absolute inset-0 bg-scrim"
        data-component="ModalScrim"
        aria-hidden="true"
        onClick={onScrimClick}
      />
      <div
        class="box flex-1 w-full h-full justify-center items-center"
        classList={{ boxNone: true }}
        style={{ padding: cssGap(MODAL_CONTENT_MARGIN_STEP) }}
      >
        {props.children}
      </div>
    </div>
  );
}
