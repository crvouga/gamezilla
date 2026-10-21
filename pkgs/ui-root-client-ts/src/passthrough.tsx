/** @jsxImportSource solid-js */
/**
 * Passthrough bottom-sheet host: `open` gates children in place (no portal,
 * no backdrop, no focus trap). `supportsSheetPresentation: false` makes
 * {@link ResponsiveSurface} take the centered-modal path instead, so this
 * host is only for trees that must not mount sheet chrome (harness / DST).
 */

import type {
  BottomSheetHost,
  BottomSheetHostSheetProps,
} from '@pkgs/ui-root-shared-ts/bottom-sheet-host-types';
import { type JSX, Show } from 'solid-js';

function PassthroughSheet(props: BottomSheetHostSheetProps): JSX.Element {
  return <Show when={props.open}>{props.children}</Show>;
}

export function createPassthroughBottomSheetHost(): BottomSheetHost {
  return { Sheet: PassthroughSheet, supportsSheetPresentation: false };
}
