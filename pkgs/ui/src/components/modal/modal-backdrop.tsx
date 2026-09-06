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
import type { ComponentDataSet } from '../../component-id';
import { MODAL_CONTENT_MARGIN_STEP } from '../../theme/modal-size';
import { Box } from '../box';
import styles from '../hosts.module.css';

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
    <Box
      sx={{ flex: 1, width: '100%', height: '100%' }}
      dataSet={{ component: 'ModalBackdrop', ...props.dataSet }}
    >
      <Box
        aria-hidden="true"
        onClick={onScrimClick}
        sx={{ absoluteFill: true, backgroundColor: 'scrim' }}
        dataSet={{ component: 'ModalScrim' }}
      />
      <Box
        class={styles['boxNone']}
        sx={{
          flex: 1,
          width: '100%',
          height: '100%',
          justifyContent: 'center',
          alignItems: 'center',
          p: MODAL_CONTENT_MARGIN_STEP,
        }}
      >
        {props.children}
      </Box>
    </Box>
  );
}
